"use strict";

const inquiryRepository = require("./inquiry.repository");
const { NotFoundError, ConflictError, ValidationError } = require("../../shared/apiError");
const { INQUIRY_STATUS } = require("../../shared/constants");
const { generateInquiryId } = require("../../shared/idGenerator");

class InquiryService {
  async getAll({ status, search, includeDeleted = false } = {}) {
    const filter = {};
    if (!includeDeleted) {
      filter.isDeleted = false;
    }
    if (status && status !== "All") {
      filter.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { mobile: regex },
        { subject: regex },
        { message: regex },
      ];
    }

    return inquiryRepository.findAll({ filter });
  }

  async getById(id) {
    const inquiry = await inquiryRepository.findById(id);
    if (!inquiry) {
      throw new NotFoundError(`Inquiry "${id}" not found.`);
    }
    return inquiry;
  }

  async getNextId() {
    const year = new Date().getFullYear();
    const maxSuffix = await inquiryRepository.getMaxIdSuffix(year);
    return generateInquiryId(maxSuffix, year);
  }

  async create(body) {
    let id = body.id?.trim();
    if (!id || !/^INQ-/i.test(id)) {
      id = await this.getNextId();
    }

    let existing = await inquiryRepository.findById(id);
    if (existing) {
      const year = new Date().getFullYear();
      let maxSuffix = await inquiryRepository.getMaxIdSuffix(year);
      do {
        maxSuffix += 1;
        id = generateInquiryId(maxSuffix, year);
        existing = await inquiryRepository.findById(id);
      } while (existing);
    }

    const status =
      body.status === "Lead" ? INQUIRY_STATUS.INQUIRY : body.status || INQUIRY_STATUS.INQUIRY;

    return inquiryRepository.create({
      id,
      name: body.name.trim(),
      gender: body.gender || "Male",
      mobile: body.mobile.trim(),
      email: body.email.trim().toLowerCase(),
      address: body.address?.trim() || "",
      subject: body.subject?.trim() || "General Inquiry",
      message: body.message?.trim() || "",
      status,
      contactDetails: null,
      convertedMemberId: null,
      convertedAt: null,
      statusHistory: [
        {
          status,
          changedAt: new Date(),
          changedBy: "System",
          notes: "Initial inquiry registration",
        },
      ],
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(id, body) {
    await this.getById(id);
    const updates = { ...body };
    if (updates.email) {
      updates.email = updates.email.trim().toLowerCase();
    }
    return inquiryRepository.updateById(id, updates);
  }

  async recordContact(id, contactData) {
    const existing = await this.getById(id);

    if (existing.status === INQUIRY_STATUS.CONVERTED) {
      throw new ConflictError(`Inquiry "${id}" has already been converted to an active Member.`);
    }
    if (existing.status === INQUIRY_STATUS.ARCHIVED) {
      throw new ConflictError(`Inquiry "${id}" is archived. Please restore it before contacting.`);
    }

    const contactNotes = contactData.contactNotes?.trim() || "";
    if (!contactNotes || contactNotes.length < 5) {
      throw new ValidationError("Contact interaction notes must be at least 5 characters long.");
    }

    const contactedBy = contactData.contactedBy?.trim() || "Admin";
    const contactMethod = contactData.contactMethod || "Phone Call";
    const contactedAt = contactData.contactedAt ? new Date(contactData.contactedAt) : new Date();

    const contactDetails = {
      contactedAt,
      contactMethod,
      contactNotes,
      contactedBy,
      followUpDate: contactData.followUpDate?.trim() || "",
      outcome: contactData.outcome?.trim() || "Interested - Converting Soon",
    };

    const historyEntry = {
      status: INQUIRY_STATUS.CONTACTED,
      changedAt: new Date(),
      changedBy: contactedBy,
      notes: `Contacted via ${contactMethod}: ${contactNotes.slice(0, 100)}`,
    };

    const currentHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];

    return inquiryRepository.updateById(id, {
      status: INQUIRY_STATUS.CONTACTED,
      contactDetails,
      statusHistory: [...currentHistory, historyEntry],
    });
  }

  async updateStatus(id, newStatus, options = {}) {
    const existing = await this.getById(id);

    // Prevent invalid transitions and duplicate conversion
    if (existing.status === INQUIRY_STATUS.CONVERTED && newStatus !== INQUIRY_STATUS.CONVERTED) {
      throw new ConflictError(
        `Inquiry "${id}" is already converted to Member "${existing.convertedMemberId || ""}". Status cannot be changed.`
      );
    }

    if (newStatus === INQUIRY_STATUS.CONVERTED && existing.status === INQUIRY_STATUS.CONVERTED) {
      throw new ConflictError(`Inquiry "${id}" is already converted to a member.`);
    }

    const patch = { status: newStatus };

    if (newStatus === INQUIRY_STATUS.INQUIRY) {
      patch.contactDetails = null;
    }

    if (newStatus === INQUIRY_STATUS.CONVERTED) {
      patch.convertedAt = new Date();
      if (options.convertedMemberId) {
        patch.convertedMemberId = options.convertedMemberId;
      }
    }

    const currentHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
    const historyEntry = {
      status: newStatus,
      changedAt: new Date(),
      changedBy: options.changedBy || "Admin",
      notes: options.notes || `Status transitioned to ${newStatus}`,
    };

    patch.statusHistory = [...currentHistory, historyEntry];

    return inquiryRepository.updateById(id, patch);
  }

  async archive(id, reason = "") {
    const existing = await this.getById(id);
    if (existing.status === INQUIRY_STATUS.CONVERTED) {
      throw new ConflictError(`Inquiry "${id}" has already been converted to a member.`);
    }

    return this.updateStatus(id, INQUIRY_STATUS.ARCHIVED, {
      notes: reason || "Lead moved to Archived after contact follow-up",
    });
  }

  async softDelete(id) {
    const existing = await this.getById(id);
    if (existing.isDeleted) {
      throw new ConflictError("Inquiry is already deleted.");
    }
    return inquiryRepository.updateById(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }

  async restore(id) {
    const existing = await this.getById(id);
    if (!existing.isDeleted) {
      throw new ConflictError("Inquiry is not deleted.");
    }
    return inquiryRepository.updateById(id, {
      isDeleted: false,
      deletedAt: null,
    });
  }

  async delete(id) {
    await this.getById(id);
    await inquiryRepository.deleteById(id);
    return { id, deleted: true };
  }
}

module.exports = new InquiryService();
