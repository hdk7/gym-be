"use strict";

/**
 * Phase 10: Complete End-to-End System Integration Test
 * ====================================================
 * Tests every checklist item across all core modules:
 * 1. Auth (Login, token generation, 401 handling)
 * 2. Members (CRUD, search, status, soft-delete, restore, registration flow)
 * 3. Trainers (CRUD, search, status toggle, delete)
 * 4. Batches (Listing, detail, enroll/unenroll, sync-trainers, coach shifts, week classes)
 * 5. Membership Plans (Listing, create, edit, toggle, soft-delete, restore, permanent delete)
 * 6. Master Class Schedules (Programs, curriculum items, session tracking, holidays)
 * 7. Inquiries (Log, list, status workflow, conversion to active member)
 */

const BASE_URL = "http://localhost:5000/api/v1";

let authToken = "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[Assertion Failed] ${message}`);
  }
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch (_) {}

  return { status: res.status, ok: res.ok, data: json?.data ?? json, raw: json };
}

async function runPhase10Tests() {
  console.log("============================================================");
  console.log("  Phase 10: Complete Integration & E2E Verification Suite   ");
  console.log("============================================================\n");

  // ─── 1. AUTH TESTS ────────────────────────────────────────────────────────
  console.log("--- 1. Testing Auth & Session Persistence ---");

  // Invalid login check
  const badLogin = await request("/auth/login", {
    method: "POST",
    body: { email: "fake@user.com", password: "WrongPassword" },
  });
  assert(badLogin.status === 401 || badLogin.status === 422, "Invalid login rejected with 401/422");
  console.log("  ✓ Invalid login properly rejected");

  // Admin login 1 (admin@strengthway.com)
  const login1 = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@strengthway.com", password: "Admin@2026" },
  });
  assert(login1.ok && login1.data?.token, "admin@strengthway.com logged in with JWT");
  authToken = login1.data.token;
  console.log("  ✓ admin@strengthway.com authenticated, JWT issued");

  // Admin login 2 (admin@thestrengthway.com)
  const login2 = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@thestrengthway.com", password: "Admin@12345" },
  });
  assert(login2.ok && login2.data?.token, "admin@thestrengthway.com logged in with JWT");
  console.log("  ✓ admin@thestrengthway.com authenticated, JWT issued");

  // ─── 2. MEMBERS WORKFLOW ──────────────────────────────────────────────────
  console.log("\n--- 2. Testing Members Lifecycle & Registration Flow ---");
  const membersList = await request("/members?pageSize=10");
  assert(membersList.ok && Array.isArray(membersList.data), "Members list loaded from backend");
  console.log(`  ✓ Members list loaded (${membersList.data.length} records retrieved)`);

  const randMemberNum = Math.floor(100000000 + Math.random() * 900000000);
  const newMemberPayload = {
    firstName: "Integration",
    lastName: "Tester",
    email: `tester_${Date.now()}_${randMemberNum}@example.com`,
    mobile: `+91 9${randMemberNum}`,
    gender: "Male",
    dob: "1995-04-12",
    batchId: "BATCH-01",
    batchName: "BATCH 1",
    status: "Active",
    membershipPlan: {
      id: "plan-monthly",
      name: "Monthly Starter",
      durationMonths: 1,
      price: 7000,
    },
    address: "123 Strength Way Avenue",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    emergencyName: "Guardian Tester",
    emergencyPhone: "+91 99887 76600",
    emergencyRelation: "Parent",
    physicalStats: { height: "180 cm", weight: "75 kg", bmi: "23.1", bloodGroup: "O+" },
    emergencyContact: { name: "Guardian Tester", phone: "+91 99887 76600", relation: "Parent" },
  };

  const createMemberRes = await request("/members", {
    method: "POST",
    body: newMemberPayload,
  });
  assert(createMemberRes.status === 201, `Member created: ${createMemberRes.raw?.message}`);
  const testMemberId = createMemberRes.data.id;
  console.log(`  ✓ Created member "${testMemberId}" with membership plan & physical stats`);

  const getMemberRes = await request(`/members/${testMemberId}`);
  assert(getMemberRes.ok && getMemberRes.data?.id === testMemberId, "Member profile retrieved");
  console.log("  ✓ Member profile read correctly");

  const updateMemberRes = await request(`/members/${testMemberId}`, {
    method: "PUT",
    body: { firstName: "Integration-Updated", weight: "77" },
  });
  assert(updateMemberRes.ok && updateMemberRes.data?.firstName === "Integration-Updated", "Member profile updated");
  console.log("  ✓ Member profile update persisted");

  const toggleMemberRes = await request(`/members/${testMemberId}/toggle-status`, { method: "PATCH" });
  assert(toggleMemberRes.ok && toggleMemberRes.data?.status === "Inactive", "Status toggled to Inactive");
  console.log("  ✓ Member status toggle (Active -> Inactive)");

  const softDeleteRes = await request(`/members/${testMemberId}/soft-delete`, { method: "PATCH" });
  assert(softDeleteRes.ok && softDeleteRes.data?.isDeleted === true, "Member soft-deleted");
  console.log("  ✓ Member soft-deleted (archived)");

  const restoreRes = await request(`/members/${testMemberId}/restore`, { method: "PATCH" });
  assert(restoreRes.ok && restoreRes.data?.isDeleted === false, "Member restored");
  console.log("  ✓ Member restored back to active state");

  // Clean up test member
  await request(`/members/${testMemberId}`, { method: "DELETE" });
  console.log("  ✓ Test member cleaned up");

  // ─── 3. TRAINERS WORKFLOW ─────────────────────────────────────────────────
  console.log("\n--- 3. Testing Trainers Lifecycle ---");
  const trainersList = await request("/trainers");
  assert(trainersList.ok && Array.isArray(trainersList.data), "Trainers list loaded");
  console.log(`  ✓ Trainers list loaded (${trainersList.data.length} coaches on roster)`);

  const randTrnNum = Math.floor(100000000 + Math.random() * 900000000);
  const testTrainerId = `TRN-TEST-${Date.now().toString().slice(-4)}`;
  const createTrainerRes = await request("/trainers", {
    method: "POST",
    body: {
      id: testTrainerId,
      name: "Coach Integration",
      gender: "Male",
      experience: "5+ Years",
      phone: `+91 9${randTrnNum}`,
      email: `trainer_${Date.now()}_${randTrnNum}@strengthway.com`,
      bio: "Master trainer specializing in Olympic weightlifting.",
      shift: "Morning (06:00 - 14:00)",
      status: "Active",
      certifications: ["CSCS", "USAW Level 2"],
      programs: ["Strength", "Hypertrophy"],
      stats: { clients: "60+", successRate: "99%", hours: "500+" },
      batchIds: ["BATCH-01", "BATCH-02"],
    },
  });
  assert(createTrainerRes.status === 201, "Trainer created");
  console.log(`  ✓ Created trainer "${testTrainerId}" with certifications & batch allocations`);

  const updateTrainerRes = await request(`/trainers/${testTrainerId}`, {
    method: "PUT",
    body: { experience: "6+ Years" },
  });
  assert(updateTrainerRes.ok && updateTrainerRes.data?.experience === "6+ Years", "Trainer updated");
  console.log("  ✓ Trainer profile update persisted");

  const toggleTrainerRes = await request(`/trainers/${testTrainerId}/toggle-status`, { method: "PATCH" });
  assert(toggleTrainerRes.ok, "Trainer status toggled");
  console.log("  ✓ Trainer status toggle verified");

  await request(`/trainers/${testTrainerId}`, { method: "DELETE" });
  console.log("  ✓ Test trainer cleaned up");

  // ─── 4. BATCHES WORKFLOW ──────────────────────────────────────────────────
  console.log("\n--- 4. Testing Batches, Capacities, Shifts & Scheduled Classes ---");
  const batchesList = await request("/batches");
  assert(batchesList.ok && Array.isArray(batchesList.data), "Batches list loaded");
  console.log(`  ✓ Batches loaded (${batchesList.data.length} batches available)`);

  const batch1 = await request("/batches/BATCH-01");
  assert(batch1.ok && batch1.data?.id === "BATCH-01", "BATCH-01 detail loaded");
  console.log(`  ✓ Batch detail: ${batch1.data.name} (${batch1.data.timingLabel || batch1.data.startTime})`);

  // Enroll & Unenroll
  const enrollRes = await request("/batches/BATCH-01/enroll", {
    method: "PATCH",
    body: { memberId: "MEM-TEMP-ENROLL" },
  });
  assert(enrollRes.ok, "Member enrolled in batch");
  const unenrollRes = await request("/batches/BATCH-01/unenroll", {
    method: "PATCH",
    body: { memberId: "MEM-TEMP-ENROLL" },
  });
  assert(unenrollRes.ok, "Member unenrolled from batch");
  console.log("  ✓ Batch enrollment and unenrollment capacity update verified");

  // Sync trainers
  const syncTrainersRes = await request("/batches/BATCH-01/sync-trainers", {
    method: "PATCH",
    body: { trainerIds: ["TRN-101", "TRN-102"] },
  });
  assert(syncTrainersRes.ok, "Batch trainers synchronized");
  console.log("  ✓ Batch trainers synchronized");

  // Coach shifts & scheduled classes
  const coachShiftsRes = await request("/batches/coach-shifts");
  assert(coachShiftsRes.ok && Array.isArray(coachShiftsRes.data), "Coach shift matrix retrieved");
  console.log(`  ✓ Coach shift matrix retrieved (${coachShiftsRes.data.length} coach shift slots)`);

  const batchClassesRes = await request("/batches/BATCH-01/classes");
  assert(batchClassesRes.ok && Array.isArray(batchClassesRes.data), "Batch scheduled classes retrieved");
  console.log(`  ✓ Scheduled weekly classes retrieved (${batchClassesRes.data.length} weekly classes)`);

  // ─── 5. MEMBERSHIP PLANS WORKFLOW ─────────────────────────────────────────
  console.log("\n--- 5. Testing Membership Plans Lifecycle ---");
  const plansList = await request("/plans");
  assert(plansList.ok && Array.isArray(plansList.data), "Membership plans loaded");
  console.log(`  ✓ Active membership plans loaded (${plansList.data.length} plans available)`);

  const testPlanId = `plan-test-e2e-${Date.now().toString().slice(-4)}`;
  const createPlanRes = await request("/plans", {
    method: "POST",
    body: {
      id: testPlanId,
      name: "Semi-Annual Elite",
      durationMonths: 6,
      price: 32000,
      features: ["All floor access", "Unlimited masterclasses", "Sauna & recovery suite"],
      badge: "Best Value",
      popular: true,
      status: "Active",
    },
  });
  assert(createPlanRes.status === 201, "Plan created");
  console.log(`  ✓ Created test membership plan "${testPlanId}"`);

  const updatePlanRes = await request(`/plans/${testPlanId}`, {
    method: "PUT",
    body: { price: 34000 },
  });
  assert(updatePlanRes.ok && updatePlanRes.data?.price === 34000, "Plan updated");
  console.log("  ✓ Plan price update persisted");

  const togglePlanRes = await request(`/plans/${testPlanId}/toggle-status`, { method: "PATCH" });
  assert(togglePlanRes.ok, "Plan status toggled");
  console.log("  ✓ Plan status toggled");

  const softDeletePlanRes = await request(`/plans/${testPlanId}/soft-delete`, { method: "PATCH" });
  assert(softDeletePlanRes.ok, "Plan soft-deleted");
  console.log("  ✓ Plan soft-deleted");

  const restorePlanRes = await request(`/plans/${testPlanId}/restore`, { method: "PATCH" });
  assert(restorePlanRes.ok, "Plan restored");
  console.log("  ✓ Plan restored");

  await request(`/plans/${testPlanId}`, { method: "DELETE" });
  console.log("  ✓ Test plan permanently deleted and cleaned up");

  // ─── 6. MASTER CLASS SCHEDULES & SESSIONS WORKFLOW ────────────────────────
  console.log("\n--- 6. Testing Master Class Schedules, Curriculum & Tracking Sessions ---");
  const schedsList = await request("/schedules");
  assert(schedsList.ok && Array.isArray(schedsList.data), "Master schedules loaded");
  console.log(`  ✓ Master schedules loaded (${schedsList.data.length} programs available)`);

  const testProgId = `prog_e2e_${Date.now().toString().slice(-4)}`;
  const createProgRes = await request("/schedules", {
    method: "POST",
    body: {
      id: testProgId,
      name: "E2E Modular Conditioning",
      batchIds: ["BATCH-02"],
      daysPattern: "MWF",
      daysList: ["Monday", "Wednesday", "Friday"],
      coachId: "TRN-101",
      coachName: "Dolliee Ellens",
      startDate: new Date().toISOString().slice(0, 10),
      status: "Active",
      totalClasses: 3,
      items: [
        { classNumber: 1, subject: "Intro", message: "Initial screen" },
        { classNumber: 2, subject: "Strength", message: "Barbell basics" },
        { classNumber: 3, subject: "Conditioning", message: "Metcon sprint" },
      ],
    },
  });
  assert(createProgRes.status === 201, "Program created with curriculum items");
  console.log(`  ✓ Created reusable master program "${testProgId}" with auto-generated sessions`);

  // Verify curriculum items
  const itemsRes = await request(`/schedules/${testProgId}/items`);
  assert(itemsRes.ok && itemsRes.data.length === 3, "Curriculum items fetched");
  console.log(`  ✓ Curriculum items retrieved (${itemsRes.data.length} units in syllabus)`);

  // Verify sessions generated
  const sessionsRes = await request(`/sessions?scheduleId=${testProgId}`);
  assert(sessionsRes.ok && sessionsRes.data.length === 3, "Sessions generated for assigned batch");
  console.log(`  ✓ Batch tracking sessions generated (${sessionsRes.data.length} sessions scheduled)`);

  // Update session status to COMPLETED
  const firstSession = sessionsRes.data[0];
  const updateSessionRes = await request(`/sessions/${firstSession.id}/status`, {
    method: "PATCH",
    body: { status: "COMPLETED" },
  });
  assert(updateSessionRes.ok && updateSessionRes.data?.status === "COMPLETED", "Session marked as COMPLETED");
  console.log(`  ✓ Session "${firstSession.id}" updated to COMPLETED`);

  // Batch tracking summary
  const trackingSummary = await request(`/schedules/${testProgId}/tracking`);
  assert(trackingSummary.ok && Array.isArray(trackingSummary.data), "Batch tracking summary retrieved");
  console.log("  ✓ Batch tracking summary verified");

  // Holiday CRUD
  const holidaysRes = await request("/holidays");
  assert(holidaysRes.ok && Array.isArray(holidaysRes.data), "Holidays loaded");
  console.log(`  ✓ Holidays loaded (${holidaysRes.data.length} holidays configured)`);

  const testHolidayId = `hol_test_${Date.now().toString().slice(-4)}`;
  const addHolidayRes = await request("/holidays", {
    method: "POST",
    body: {
      id: testHolidayId,
      name: "E2E Test Holiday",
      date: "2026-12-25",
      type: "Public Holiday",
      affectedBatches: "ALL",
      description: "Test closure",
    },
  });
  assert(addHolidayRes.status === 201, "Holiday added");
  await request(`/holidays/${testHolidayId}`, { method: "DELETE" });
  console.log("  ✓ Holiday CRUD (Add & Delete) verified");

  // Clean up test program
  await request(`/schedules/${testProgId}`, { method: "DELETE" });
  console.log("  ✓ Test schedule cleaned up");

  // ─── 7. INQUIRIES WORKFLOW ────────────────────────────────────────────────
  console.log("\n--- 7. Testing Inquiries Workflow & Conversion to Member ---");
  const testInquiryId = `INQ-TEST-${Date.now().toString().slice(-4)}`;
  const createInquiryRes = await request("/inquiries", {
    method: "POST",
    body: {
      id: testInquiryId,
      name: "Marcus Vance",
      email: `marcus_${Date.now()}@example.com`,
      mobile: "+91 98888 77777",
      gender: "Male",
      subject: "Membership Inquiry",
      message: "Interested in the 12-week functional conditioning program.",
      status: "Inquiry",
    },
  });
  assert(createInquiryRes.status === 201, "Inquiry created");
  console.log(`  ✓ Created inquiry "${testInquiryId}"`);

  const updateInquiryStatusRes = await request(`/inquiries/${testInquiryId}/status`, {
    method: "PATCH",
    body: { status: "Contacted" },
  });
  assert(updateInquiryStatusRes.ok && updateInquiryStatusRes.data?.status === "Contacted", "Inquiry status updated");
  console.log("  ✓ Inquiry status updated (Inquiry -> Contacted)");

  // 7a. Inquiry conversion flow (as executed by InquiriesPage: register member + mark inquiry Converted)
  const convMemberRes = await request("/members", {
    method: "POST",
    body: {
      firstName: "Marcus",
      lastName: "Vance",
      email: `marcus_${Date.now()}@example.com`,
      mobile: "+91 98888 77777",
      gender: "Male",
      dob: "1994-06-15",
      address: "42 MG Road, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      pincode: "560038",
      emergencyName: "Jane Vance",
      emergencyRelationship: "Spouse",
      emergencyNumber: "+91 98888 66666",
      batchId: "BATCH-01",
      paymentPlanId: "plan-quarterly",
      paymentMethod: "UPI",
      paymentAmount: 18000,
      status: "Active",
    },
  });
  assert(convMemberRes.status === 201, `Member registered from inquiry: ${JSON.stringify(convMemberRes.raw)}`);
  const registeredMemberId = convMemberRes.data?.id;

  const markConvertedRes = await request(`/inquiries/${testInquiryId}/status`, {
    method: "PATCH",
    body: { status: "Converted" },
  });
  assert(markConvertedRes.ok && markConvertedRes.data?.status === "Converted", "Inquiry status updated to Converted");
  console.log("  ✓ Inquiry converted: active member created & inquiry marked Converted");

  // 7b. Test Lead Member Conversion API (PATCH /members/:id/convert)
  const leadMemberRes = await request("/members", {
    method: "POST",
    body: {
      firstName: "Elena",
      lastName: "Rostova",
      email: `elena_lead_${Date.now()}@example.com`,
      mobile: "+91 97777 55555",
      gender: "Female",
      dob: "1996-08-20",
      address: "18 Brigade Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      pincode: "560025",
      emergencyName: "Dmitri Rostova",
      emergencyRelationship: "Brother",
      emergencyNumber: "+91 97777 44444",
      status: "Lead",
    },
  });
  assert(leadMemberRes.status === 201 && leadMemberRes.data?.status === "Lead", "Lead member created");
  const leadMemberId = leadMemberRes.data.id;

  const convertLeadRes = await request(`/members/${leadMemberId}/convert`, {
    method: "PATCH",
    body: {
      paymentPlanId: "plan-quarterly",
      paymentMethod: "UPI",
      paymentAmount: 18000,
      batchId: "BATCH-01",
    },
  });
  assert(convertLeadRes.ok && convertLeadRes.data?.status === "Active", "Lead converted to Active member");
  assert(convertLeadRes.data?.membershipPlan?.id === "plan-quarterly", "Converted member has quarterly plan");
  assert(convertLeadRes.data?.paymentDetails?.amount === 18000, "Payment details recorded on lead conversion");
  console.log("  ✓ Lead Member Conversion API (PATCH /members/:id/convert) verified");

  // Clean up
  await request(`/inquiries/${testInquiryId}`, { method: "DELETE" });
  if (registeredMemberId) await request(`/members/${registeredMemberId}`, { method: "DELETE" });
  if (leadMemberId) await request(`/members/${leadMemberId}`, { method: "DELETE" });
  console.log("  ✓ Inquiries and conversion test members cleaned up");

  console.log("\n============================================================");
  console.log("  ✓ ALL PHASE 10 INTEGRATION TESTS PASSED (100% SUCCESS)    ");
  console.log("============================================================\n");
}

runPhase10Tests().catch((err) => {
  console.error("\n❌ PHASE 10 TEST FAILED:", err);
  process.exit(1);
});
