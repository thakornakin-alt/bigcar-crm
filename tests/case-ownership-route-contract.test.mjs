import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Booking ownership is derived from the authenticated actor", async () => {
  const source = await read("app/api/booking-reports/route.ts");
  assert.match(source, /submittedSalespersonUserId: actor\.id/);
  assert.match(source, /saveCaseOwnership\(ownershipFromUser\(actor/);
  assert.doesNotMatch(source, /submittedSalespersonUserId: body\.salespersonUserId/);
});

test("Sales inherits owner through exact bookingReportId", async () => {
  const source = await read("app/api/sales-reports/route.ts");
  assert.match(source, /getCaseOwnership\("booking", report\.bookingReportId\)/);
  assert.match(source, /salesOwnershipFromBooking\(bookingOwnership, saved\.id\)/);
});

test("Realtime Booking routes replace browser owner fields with session actor", async () => {
  const legacy = await read("app/api/realtime-booking/waiting/route.ts");
  const v2 = await read("app/api/realtime-booking-v2/route.ts");
  assert.match(legacy, /userId: actor\.id/);
  assert.doesNotMatch(legacy, /body\.userId/);
  assert.match(v2, /ownerUserId: actor\.id/);
  assert.match(v2, /ownerEmail: actor\.email/);
});

test("Approval captures authenticated stable ownership and actor activity", async () => {
  const source = await read("app/api/approval/logs/route.ts");
  assert.match(source, /requireWritableUser\(\)/);
  assert.match(source, /caseType: "approval"/);
  assert.match(source, /recordActivity\(actor/);
});

test("legacy compatibility is exact-full-name and ambiguity-safe", async () => {
  const source = await read("lib/case-ownership.ts");
  assert.match(source, /matches\.length === 1 \? matches\[0\] : null/);
  assert.doesNotMatch(source, /includes\(normalized\)/);
});
