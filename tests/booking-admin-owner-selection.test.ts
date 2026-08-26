import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveBookingOwnerSelection, BookingOwnerSelectionError } from "../lib/booking-owner-selection";
import { ownershipFromUser, salesOwnershipFromBooking } from "../lib/case-ownership";
import { derivePersonalDashboardMetrics } from "../lib/dashboard-personal-metrics";
import type { ReportHistoryItem, SalesUser } from "../lib/types";

function user(id: string, role: SalesUser["role"], overrides: Partial<SalesUser> = {}): SalesUser {
  return {
    id,
    role,
    email: `${id.toLowerCase()}@example.com`,
    firstName: id,
    lastName: "User",
    nickname: id,
    phone: "",
    lineId: "",
    lineQrUrl: "",
    avatarUrl: "",
    position: "",
    branch: "RDD",
    locked: false,
    createdAt: "2026-08-26T00:00:00+07:00",
    updatedAt: "2026-08-26T00:00:00+07:00",
    ...overrides
  };
}

const admin = user("ADMIN-1", "admin");
const salesA = user("SALES-A", "sales", { firstName: "บิ๊ก", nickname: "บิ๊ก" });
const salesB = user("SALES-B", "sales", { firstName: "ฝ้าย", nickname: "ฝ้าย" });

test("Sales owns its Booking and browser saleName cannot establish identity", () => {
  const result = resolveBookingOwnerSelection({ actor: salesA, requestedOwnerUserId: salesA.id });
  assert.equal(result.owner.id, salesA.id);
  assert.equal(result.saleName, "บิ๊ก");
});

test("Sales cannot select another owner", () => {
  assert.throws(
    () => resolveBookingOwnerSelection({ actor: salesA, requestedOwnerUserId: salesB.id }),
    (error) => error instanceof BookingOwnerSelectionError && error.status === 403
  );
});

test("Admin must select one canonical unlocked Sales user", () => {
  assert.throws(
    () => resolveBookingOwnerSelection({ actor: admin, canonicalUsers: [salesA, salesB] }),
    (error) => error instanceof BookingOwnerSelectionError && error.status === 400
  );
  assert.equal(resolveBookingOwnerSelection({ actor: admin, requestedOwnerUserId: salesA.id, canonicalUsers: [salesA, salesB] }).owner.id, salesA.id);
  assert.equal(resolveBookingOwnerSelection({ actor: admin, requestedOwnerUserId: salesB.id, canonicalUsers: [salesA, salesB] }).owner.id, salesB.id);
});

test("Admin cannot select missing, locked, viewer, or Admin accounts as salesperson owner", () => {
  const invalid = ["MISSING", "LOCKED", "VIEWER", admin.id];
  const users = [salesA, user("LOCKED", "sales", { locked: true }), user("VIEWER", "viewer"), admin];
  for (const requestedOwnerUserId of invalid) {
    assert.throws(
      () => resolveBookingOwnerSelection({ actor: admin, requestedOwnerUserId, canonicalUsers: users }),
      (error) => error instanceof BookingOwnerSelectionError && error.status === 400
    );
  }
});

test("Case Ownership and Sales inheritance preserve selected owner, not Admin actor", () => {
  const selected = resolveBookingOwnerSelection({ actor: admin, requestedOwnerUserId: salesA.id, canonicalUsers: [salesA] });
  const booking = ownershipFromUser(selected.owner, { caseType: "booking", caseId: "BR-X" });
  const sales = salesOwnershipFromBooking(booking, "SR-X");
  assert.equal(booking.ownerUserId, salesA.id);
  assert.equal(sales.ownerUserId, salesA.id);
  assert.notEqual(booking.ownerUserId, admin.id);
  assert.equal(sales.sourceCaseId, "BR-X");
});

test("Booking route keeps actor audit separate and passes selected owner downstream", async () => {
  const route = await readFile(new URL("../app/api/booking-reports/route.ts", import.meta.url), "utf8");
  assert.match(route, /ownershipFromUser\(ownerSelection\.owner/);
  assert.match(route, /upsertBookingDeliveryFromBookingReport\([\s\S]*ownerSelection\.owner/);
  assert.match(route, /recordActivity\(actor/);
  assert.match(route, /requestedOwnerUserId: body\.salespersonUserId/);
});

test("Dashboard attributes an Admin-created Booking to selected salesperson only", () => {
  const booking = {
    id: "BR-ADMIN-FOR-A",
    type: "booking",
    bookingDate: "2026-08-26",
    createdAt: "2026-08-26T00:00:00+07:00",
    updatedAt: "2026-08-26T00:00:00+07:00",
    status: "draft",
    customerName: "Fixture Customer",
    phone: "",
    idCard: "",
    plate: "TEST 1",
    brand: "",
    model: "",
    year: "",
    color: "",
    saleName: "บิ๊ก",
    teamName: "",
    emailSubject: "",
    emailTo: "",
    emailCc: "",
    emailStatus: "",
    lineStatus: "",
    ocrStatus: "",
    emailDraftId: "",
    driveFolderUrl: "",
    attachments: [],
    reportText: ""
  } satisfies ReportHistoryItem;
  const ownership = [ownershipFromUser(salesA, { caseType: "booking", caseId: booking.id })];
  const shared = { month: "2026-08", now: new Date("2026-08-26T12:00:00+07:00"), leads: [], reports: [booking], prepRecords: [], bookingDeliveries: [], ownership, users: [admin, salesA] };
  assert.equal(derivePersonalDashboardMetrics({ ...shared, targetUserId: salesA.id }).bookings, 1);
  assert.equal(derivePersonalDashboardMetrics({ ...shared, targetUserId: admin.id }).bookings, 0);
});
