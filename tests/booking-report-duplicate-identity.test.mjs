import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeBookingPlate,
  requiresBookingDuplicateConfirmation,
  resolveBookingCustomerIdentity
} from "../lib/booking-report-duplicate.ts";

const base = {
  bookingDate: "2026-08-24",
  customerName: " นายทดสอบ ลูกค้า ",
  idCard: "0123456789012",
  phone: "0917785117",
  plate: "1กก 1234"
};

test("Booking customer identity prefers exact Citizen/Tax ID and preserves leading zero", () => {
  assert.deepEqual(resolveBookingCustomerIdentity(base), { type: "citizen_or_tax_id", value: "0123456789012" });
  assert.equal(resolveBookingCustomerIdentity({ idCard: "", customerName: "  นายทดสอบ   ลูกค้า " }).value, "นายทดสอบ ลูกค้า");
});

test("only same proven customer and normalized plate requires confirmation", () => {
  assert.equal(normalizeBookingPlate("1กก 1234"), "1กก1234");
  assert.equal(requiresBookingDuplicateConfirmation(base, { ...base, plate: "1กก1234" }), true);
  assert.equal(requiresBookingDuplicateConfirmation(base, { ...base, idCard: "9999999999999" }), false);
  assert.equal(requiresBookingDuplicateConfirmation(base, { ...base, plate: "2ขข 5678" }), false);
  assert.equal(requiresBookingDuplicateConfirmation({ ...base, idCard: "", customerName: "" }, { ...base, idCard: "", customerName: "" }), false);
});

test("same-plate Booking A/B mutation code is stable-ID isolated", async () => {
  const delivery = await readFile(new URL("../lib/booking-delivery.ts", import.meta.url), "utf8");
  assert.match(delivery, /\["bookingReportId", text\(input\.bookingReportId\)\]/);
  assert.match(delivery, /existingStore\.records\.filter\(\(record\) => record\.bookingReportId === report\.id\)/);
  assert.doesNotMatch(delivery, /upsertBookingDeliveryRecordByPlate/);
});

test("Booking API preflights before upload and exposes safe 409 contracts", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/booking-reports/route.ts", import.meta.url), "utf8");
  assert.ok(page.indexOf("checkOnly: true") < page.indexOf("await createBookingReport(payload, requestId)"));
  assert.match(page, /พบรายงานจองเดิม/);
  assert.match(page, /เปิดรายงานเดิม/);
  assert.match(page, /ยืนยันสร้างรายงานจองใหม่\?/);
  assert.match(route, /duplicate_booking_confirmation_required/);
  assert.match(route, /idempotency_conflict/);
  assert.match(route, /duplicate_confirmation_invalid/);
});

test("Apps Script enforces signed payload-bound confirmation and bounded idempotency", async () => {
  const source = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  assert.match(source, /findBookingReportDuplicates_/);
  assert.match(source, /computeHmacSha256Signature/);
  assert.match(source, /fingerprint:bookingReportFingerprint_\(report\)/);
  assert.match(source, /actorId:String\(actorId\|\|""\)/);
  assert.match(source, /expiresAt:Date\.now\(\)\+10\*60\*1000/);
  assert.match(source, /BOOKING_CREATE_/);
  assert.match(source, /BOOKING_REPORT_IDEMPOTENCY_CONFLICT/);
  assert.match(source, /LockService\.getScriptLock/);
  assert.doesNotMatch(source, /allowDuplicate/);
});

test("Apps Script mirrors remain exact and Booking Sheet schema is unchanged", async () => {
  const canonical = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  const compact = await readFile(new URL("../google-apps-script/Code.compact.gs", import.meta.url), "utf8");
  assert.equal(compact, canonical);
  assert.match(canonical, /BOOKING_HEADERS=\["Id","CreatedAt","UpdatedAt","Status","BuyerType","CustomerName","IdCard"/);
  assert.match(canonical, /bookingReportId:String\(r\[4\]\|\|""\)/);
});

test("Booking history is not reduced to latest-by-plate and Sales import carries exact Booking ID", async () => {
  const apps = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  const salesPage = await readFile(new URL("../app/sales-reports/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(apps, /latestBookingByPlate|bookingsByPlate/);
  assert.match(salesPage, /bookingReportId:\s*report\.id/);
});
