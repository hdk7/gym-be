"use strict";

const memberRepository = require("./member.repository");
const planService = require("../membership-plans/plan.service");
const batchService = require("../batches/batch.service");
const {
  generateMemberId,
  generateTransactionId,
  generateReceiptNumber,
} = require("../../shared/idGenerator");
const {
  NotFoundError,
  ConflictError,
  ValidationError,
} = require("../../shared/apiError");
const { MEMBER_STATUS } = require("../../shared/constants");
const { calculateBmi } = require("../../shared/dateUtils");
const {
  buildPhysicalStats,
  buildEmergencyContact,
  resolveMemberPlanAndPayment,
  resolveMemberBatchAndSchedule,
} = require("./member.helpers");
const { buildMemberConversionPayload } = require("./memberConversion.helper");
const { getMemberMonthTracking } = require("./memberTracking.service");

class MemberService {
  async getAll({
    page = 1,
    pageSize = 10,
    skip = 0,
    status,
    includeDeleted = false,
    search = "",
  } = {}) {
    const filter = {};

    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    if (status && status !== "All") {
      if (status === "Archived") {
        filter.isDeleted = true;
      } else {
        filter.status = status;
        filter.isDeleted = false;
      }
    }

    if (search && search.trim() !== "") {
      const cleanSearch = search.trim();
      filter.$or = [
        { firstName: { $regex: cleanSearch, $options: "i" } },
        { lastName: { $regex: cleanSearch, $options: "i" } },
        { email: { $regex: cleanSearch, $options: "i" } },
        { mobile: { $regex: cleanSearch, $options: "i" } },
        { id: { $regex: cleanSearch, $options: "i" } },
      ];
    }

    return memberRepository.findAll({ filter, skip, limit: pageSize });
  }

  async getById(id) {
    const member = await memberRepository.findById(id);
    if (!member) {
      throw new NotFoundError(`Member with ID "${id}" not found.`);
    }
    return member;
  }

  async create(body) {
    // 1. Uniqueness checks
    const existingEmail = await memberRepository.findByEmail(body.email);
    if (existingEmail) {
      throw new ConflictError(
        `A member with email "${body.email}" already exists.`,
      );
    }

    const existingMobile = await memberRepository.findByMobile(body.mobile);
    if (existingMobile) {
      throw new ConflictError(
        `A member with mobile number "${body.mobile}" already exists.`,
      );
    }

    // 2. ID Generation
    const maxSuffix = await memberRepository.getMaxIdSuffix();
    const id = body.id || generateMemberId(maxSuffix);

    // 3. BMI & physical stats
    const stats = buildPhysicalStats(body);
    const physicalStats = {
      height: stats.height,
      weight: stats.weight,
      bmi: stats.bmi,
      bloodGroup: stats.bloodGroup,
    };

    // 4. Emergency contact
    const emergencyContact = buildEmergencyContact(body);

    // 5. Membership plan & payment snapshot
    const { membershipPlan, paymentDetails } =
      await resolveMemberPlanAndPayment(body, planService);

    // 6. Batch lookup & schedule
    const { schedule, batchId, batchName, batchTiming, assignedBatch } =
      await resolveMemberBatchAndSchedule(body, null, batchService);

    // 7. Member payload
    const newMemberData = {
      id,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.toLowerCase().trim(),
      mobile: body.mobile.trim(),
      gender: body.gender,
      dob: body.dob,
      height: stats.heightStr,
      weight: stats.weightStr,
      bloodGroup: body.bloodGroup || "",
      address: body.address || "",
      city: body.city || "",
      state: body.state || "",
      country: body.country || "India",
      pincode: body.pincode || "",
      photo: body.photo || body.photoUrl || null,
      photoName: body.photoName || null,
      bio: body.bio || "",
      status: body.status || MEMBER_STATUS.ACTIVE,
      isDeleted: false,
      deletedAt: null,
      batchId,
      batchName,
      batchTiming,
      assignedBatch,
      schedule,
      batchHistory:
        Array.isArray(body.batchHistory) && body.batchHistory.length > 0
          ? body.batchHistory
          : batchId
            ? [
                {
                  assignmentId: `ASG-${id}-INIT`,
                  type: "PRIMARY",
                  batchId,
                  batchName,
                  batchTiming,
                  startDate: new Date().toISOString().slice(0, 10),
                  endDate: null,
                  reason: "Initial enrollment",
                  transferredAt: new Date(),
                  transferredBy: "Admin",
                  status: "COMPLETED",
                },
              ]
            : [],
      activeFlexAssignments: Array.isArray(body.activeFlexAssignments)
        ? body.activeFlexAssignments
        : [],
      physicalStats,
      emergencyName: emergencyContact.name,
      emergencyPhone: emergencyContact.phone,
      emergencyRelation: emergencyContact.relation,
      emergencyContact,
      medicalDoc: body.medicalDoc || {
        submitted: false,
        clearanceDate: null,
        notes: "",
      },
      membershipPlan,
      paymentDetails,
      convertedAt: null,
      registeredAt: body.registeredAt
        ? new Date(body.registeredAt)
        : new Date(),
    };

    const saved = await memberRepository.create(newMemberData);

    // Auto-enroll member into batch
    if (batchId) {
      await batchService.enrollMember(batchId, id).catch(() => null);
    }

    return saved;
  }

  async update(id, body) {
    const existing = await this.getById(id);

    // Email conflict check if updated
    if (body.email && body.email.toLowerCase().trim() !== existing.email) {
      const emailConflict = await memberRepository.findByEmail(body.email);
      if (emailConflict && emailConflict.id !== id) {
        throw new ConflictError(
          `Email "${body.email}" is already used by another member.`,
        );
      }
    }

    // Mobile conflict check if updated
    if (body.mobile && body.mobile.trim() !== existing.mobile) {
      const mobileConflict = await memberRepository.findByMobile(body.mobile);
      if (mobileConflict && mobileConflict.id !== id) {
        throw new ConflictError(
          `Mobile number "${body.mobile}" is already used by another member.`,
        );
      }
    }

    const updates = { ...body };

    // Recompute physical stats if height/weight/bloodGroup updated
    const heightStr =
      body.height !== undefined
        ? String(body.height).replace(/\s*cm/i, "")
        : existing.height;
    const weightStr =
      body.weight !== undefined
        ? String(body.weight).replace(/\s*kg/i, "")
        : existing.weight;
    const bmiVal = calculateBmi(heightStr, weightStr);

    updates.physicalStats = {
      height: heightStr ? `${heightStr} cm` : "",
      weight: weightStr ? `${weightStr} kg` : "",
      bmi: bmiVal ? String(bmiVal) : existing.physicalStats?.bmi || "",
      bloodGroup: body.bloodGroup || existing.bloodGroup || "",
    };

    // Emergency contact merge
    const emergencyName =
      body.emergencyName ||
      body.emergencyContact?.name ||
      existing.emergencyContact?.name ||
      "";
    const emergencyPhone =
      body.emergencyPhone ||
      body.emergencyNumber ||
      body.emergencyContact?.phone ||
      existing.emergencyContact?.phone ||
      "";
    const emergencyRelation =
      body.emergencyRelation ||
      body.emergencyRelationship ||
      body.emergencyContact?.relation ||
      existing.emergencyContact?.relation ||
      "";

    updates.emergencyContact = {
      name: emergencyName,
      phone: emergencyPhone,
      relation: emergencyRelation,
    };
    updates.emergencyName = emergencyName;
    updates.emergencyPhone = emergencyPhone;
    updates.emergencyRelation = emergencyRelation;

    // Handle batch changes if batchId is being changed
    if (body.batchId !== undefined && body.batchId !== existing.batchId) {
      if (body.batchId) {
        try {
          const newBatch = await batchService.getById(body.batchId);
          if (newBatch) {
            updates.batchId = newBatch.id;
            updates.batchName = newBatch.name;
            updates.batchTiming = newBatch.timingLabel;
            updates.assignedBatch = newBatch.name;
            updates.schedule = {
              batchId: newBatch.id,
              batchName: newBatch.name,
              batchTiming: newBatch.timingLabel,
              daysLabel: newBatch.daysLabel,
              daysPattern: newBatch.daysPattern,
            };
            if (existing.batchId) {
              await batchService
                .unenrollMember(existing.batchId, id)
                .catch(() => null);
            }
            await batchService.enrollMember(body.batchId, id).catch(() => null);
          }
        } catch {
          // Fallback
        }
      } else {
        if (existing.batchId) {
          await batchService
            .unenrollMember(existing.batchId, id)
            .catch(() => null);
        }
        updates.batchId = "";
        updates.batchName = "";
        updates.batchTiming = "";
        updates.assignedBatch = "Unassigned";
        updates.schedule = null;
      }
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }

    return memberRepository.updateById(id, updates);
  }

  async softDelete(id) {
    const existing = await this.getById(id);
    if (existing.isDeleted) {
      throw new ConflictError(`Member "${id}" is already archived.`);
    }

    const updated = await memberRepository.updateById(id, {
      isDeleted: true,
      deletedAt: new Date(),
      status: MEMBER_STATUS.ARCHIVED,
    });

    if (existing.batchId) {
      await batchService.unenrollMember(existing.batchId, id).catch(() => null);
    }

    return updated;
  }

  async restore(id) {
    const existing = await memberRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Member with ID "${id}" not found.`);
    }
    if (!existing.isDeleted) {
      throw new ConflictError(`Member "${id}" is not archived.`);
    }

    const updated = await memberRepository.updateById(id, {
      isDeleted: false,
      deletedAt: null,
      status: MEMBER_STATUS.ACTIVE,
    });

    if (existing.batchId) {
      await batchService.enrollMember(existing.batchId, id).catch(() => null);
    }

    return updated;
  }

  async permanentDelete(id) {
    const existing = await this.getById(id);
    if (existing.batchId) {
      await batchService.unenrollMember(existing.batchId, id).catch(() => null);
    }
    await memberRepository.deleteById(id);
    return { id: existing.id, deleted: true };
  }

  async toggleStatus(id) {
    const existing = await this.getById(id);
    const nextStatus =
      existing.status === MEMBER_STATUS.ACTIVE
        ? MEMBER_STATUS.INACTIVE
        : MEMBER_STATUS.ACTIVE;

    return memberRepository.updateById(id, { status: nextStatus });
  }

  async convertLead(id, body) {
    const existing = await this.getById(id);
    const convertibleStatuses = [
      MEMBER_STATUS.LEAD,
      MEMBER_STATUS.INQUIRY,
      MEMBER_STATUS.CONTACTED,
    ];
    if (!convertibleStatuses.includes(existing.status)) {
      throw new ConflictError(
        `Member "${id}" cannot be converted because current status is "${existing.status}" (must be "Inquiry", "Contacted", or "Lead").`,
      );
    }

    const plan = await planService.getById(body.paymentPlanId);
    const conversionPayload = await buildMemberConversionPayload({
      existing,
      plan,
      body,
      batchService,
    });

    return memberRepository.updateById(id, conversionPayload);
  }

  async recordContact(id, contactData) {
    const existing = await this.getById(id);
    if (
      existing.status === MEMBER_STATUS.ACTIVE ||
      existing.status === MEMBER_STATUS.CONVERTED
    ) {
      throw new ConflictError(
        `Member "${id}" is already active and converted.`,
      );
    }

    const contactNotes = contactData.contactNotes?.trim() || "";
    if (!contactNotes || contactNotes.length < 5) {
      throw new ValidationError(
        "Contact interaction notes must be at least 5 characters long.",
      );
    }

    const contactedBy = contactData.contactedBy?.trim() || "Admin";
    const contactMethod = contactData.contactMethod || "Phone Call";
    const contactedAt = contactData.contactedAt
      ? new Date(contactData.contactedAt)
      : new Date();

    const contactDetails = {
      contactedAt,
      contactMethod,
      contactNotes,
      contactedBy,
      followUpDate: contactData.followUpDate?.trim() || "",
      outcome: contactData.outcome?.trim() || "Interested - Converting Soon",
    };

    const currentHistory = Array.isArray(existing.statusHistory)
      ? existing.statusHistory
      : [];
    const historyEntry = {
      status: MEMBER_STATUS.CONTACTED,
      changedAt: new Date(),
      changedBy: contactedBy,
      notes: `Contact details recorded: ${contactNotes.slice(0, 100)}`,
    };

    return memberRepository.updateById(id, {
      status: MEMBER_STATUS.CONTACTED,
      contactDetails,
      statusHistory: [...currentHistory, historyEntry],
    });
  }

  async archiveInquiry(id, reason = "") {
    const existing = await this.getById(id);
    if (
      existing.status === MEMBER_STATUS.ACTIVE ||
      existing.status === MEMBER_STATUS.CONVERTED
    ) {
      throw new ConflictError(
        `Member "${id}" is already active and converted.`,
      );
    }

    const currentHistory = Array.isArray(existing.statusHistory)
      ? existing.statusHistory
      : [];
    const historyEntry = {
      status: MEMBER_STATUS.ARCHIVED,
      changedAt: new Date(),
      changedBy: "Admin",
      notes: reason || "Inquiry moved to Archived after contact follow-up",
    };

    return memberRepository.updateById(id, {
      status: MEMBER_STATUS.ARCHIVED,
      isDeleted: true,
      deletedAt: new Date(),
      statusHistory: [...currentHistory, historyEntry],
    });
  }

  // ─── Month-Wise Tracking for Individual Member ──────────────────────────────
  async getMemberMonthTracking(id, yearMonth) {
    const member = await this.getById(id);
    return getMemberMonthTracking(member, yearMonth);
  }
}

module.exports = new MemberService();
module.exports = new MemberService();
