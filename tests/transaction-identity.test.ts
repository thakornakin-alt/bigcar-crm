import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findBookingDeliveryMutationIndex } from "../lib/booking-delivery.ts";
import { adaptBookingDeliveryToCommissionCandidate } from "../lib/commission-candidate.ts";
import { documentOverrideKey } from "../lib/documents-v2/override-store.ts";
import { lookupByPlateReadOnly, resolveSaleForBookingReadOnly } from "../lib/report-transaction-identity.ts";
import type { BookingDeliveryRecord, ReportHistoryItem } from "../lib/types.ts";
import { buildCalendarVehicleOptions } from "../lib/vehicle-prep-cases.ts";

function report(id: string, type: "booking" | "sales", bookingReportId?: string, plate = "1กก 1234"): ReportHistoryItem {
  return { id, type, bookingReportId, createdAt: id, updatedAt: id, status: "draft", customerName: id, phone: "", idCard: "", plate, brand: "", model: "", year: "", color: "", saleName: "", teamName: "", emailSubject: "", emailTo: "", emailCc: "", emailStatus: "", lineStatus: "", ocrStatus: "", emailDraftId: "", driveFolderUrl: "", attachments: [], reportText: "การชำระเงิน: เงินสด" };
}

function delivery(id: string, bookingReportId: string, salesReportId: string, plate = "1กก 1234"): BookingDeliveryRecord {
  return { id, bookingId: `BK-${id}`, bookingReportId, salesReportId, plate, customerName: id, brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "500000", finalPrice: "490000", centralDiscount: "10000", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "เงินสด", deliveryDate: "", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "รอส่งมอบ", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "", updatedAt: "", isCounted: true };
}

test("same-plate transactions A/B remain separate and exact stable IDs select only their transaction", () => {
  const records = [delivery("BD-A", "BR-A", "SR-A"), delivery("BD-B", "BR-B", "SR-B", "1กก1234")];
  assert.equal(findBookingDeliveryMutationIndex(records, records[0]), 0);
  assert.equal(findBookingDeliveryMutationIndex(records, records[1]), 1);
  assert.equal(findBookingDeliveryMutationIndex(records, delivery("BD-C", "BR-C", "SR-C")), -1);
  assert.throws(() => findBookingDeliveryMutationIndex(records, { id: "BD-A", bookingReportId: "BR-B", bookingId: "", salesReportId: "" }), /identity ไม่ตรงกัน/);
});

test("plate lookup is read-only and formatting-equivalent duplicates conflict", () => {
  const records = [delivery("BD-A", "BR-A", "SR-A"), delivery("BD-B", "BR-B", "SR-B", "1กก1234")];
  assert.equal(lookupByPlateReadOnly(records, "1กก 1234", (item) => item.plate).status, "conflict");
  assert.equal(lookupByPlateReadOnly(records.slice(0, 1), "1กก1234", (item) => item.plate).status, "unique_read_only_match");
  assert.equal(lookupByPlateReadOnly(records, "9กก9999", (item) => item.plate).status, "not_found");
});

test("sales history joins A/B by bookingReportId and never chooses latest by plate", () => {
  const bookings = [report("BR-A", "booking"), report("BR-B", "booking", undefined, "1กก1234")];
  const sales = [report("SR-A", "sales", "BR-A"), report("SR-B", "sales", "BR-B", "1กก1234")];
  assert.equal(resolveSaleForBookingReadOnly(bookings[0], bookings, sales).status, "resolved");
  assert.equal(resolveSaleForBookingReadOnly(bookings[0], bookings, sales).sale?.id, "SR-A");
  assert.equal(resolveSaleForBookingReadOnly(bookings[1], bookings, sales).sale?.id, "SR-B");
  assert.equal(resolveSaleForBookingReadOnly(bookings[0], bookings, [report("SR-LEGACY-A", "sales"), report("SR-LEGACY-B", "sales", undefined, "1กก1234")]).status, "conflict");
});

test("Vehicle Prep leaves same-plate history unassociated unless exact relationship exists", () => {
  const bookings = [report("BR-A", "booking"), report("BR-B", "booking", undefined, "1กก1234")];
  const ambiguousSales = [report("SR-A", "sales"), report("SR-B", "sales", undefined, "1กก1234")];
  const options = buildCalendarVehicleOptions([...bookings, ...ambiguousSales], []);
  assert.equal(options.length, 2);
  const exactClosed = report("SR-A", "sales", "BR-A");
  exactClosed.status = "closed";
  assert.deepEqual(buildCalendarVehicleOptions([...bookings, exactClosed], []).map((item) => item.bookingId), ["BR-B"]);
});

test("Documents V2 and Commission remain transaction-bound for same plate", () => {
  assert.notEqual(documentOverrideKey("contract-field", "SR-A"), documentOverrideKey("contract-field", "SR-B"));
  const a = adaptBookingDeliveryToCommissionCandidate(delivery("BD-A", "BR-A", "SR-A"));
  const b = adaptBookingDeliveryToCommissionCandidate(delivery("BD-B", "BR-B", "SR-B"));
  assert.notEqual(a.bookingCaseId, b.bookingCaseId);
  assert.notEqual(a.salesReportId, b.salesReportId);
});

test("source assertions prohibit plate mutation and latest-sale reduction", async () => {
  const bookingSource = await readFile(new URL("../lib/booking-delivery.ts", import.meta.url), "utf8");
  const prepSource = await readFile(new URL("../lib/vehicle-prep-cases.ts", import.meta.url), "utf8");
  const prepPage = await readFile(new URL("../app/vehicle-prep/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(bookingSource, /upsertBookingDeliveryRecordByPlate|salesByPlate/);
  assert.doesNotMatch(prepSource, /latestSalesByPlate|latestByPlate/);
  assert.doesNotMatch(prepPage, /latestSalesByPlate|latestByPlate/);
});

test("Apps Script mirrors expose BookingReportId and enforce confirmed, idempotent duplicate Sales creation", async () => {
  for (const file of ["Code.gs", "Code.compact.gs"]) {
    const source = await readFile(new URL(`../google-apps-script/${file}`, import.meta.url), "utf8");
    assert.match(source, /bookingReportId:String\(r\[4\]\|\|""\)/);
    assert.match(source, /SALES_REPORT_DUPLICATE_CONFIRMATION_REQUIRED/);
    assert.match(source, /verifySalesDuplicateToken_/);
    assert.match(source, /SALES_REPORT_DUPLICATE_TOKEN_INVALID/);
    assert.match(source, /SALES_REPORT_IDEMPOTENCY_CONFLICT/);
    assert.doesNotMatch(source, /allowDuplicate/);
  }
});
