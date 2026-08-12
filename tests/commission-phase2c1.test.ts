import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  applyCanonicalCommissionCapture,
  commissionGroupCaptureFromLookup,
  type CommissionGroupLookupResult
} from "../lib/commission-canonical-capture.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

const appsScript = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const appsScriptService = fs.readFileSync(new URL("../lib/apps-script.ts", import.meta.url), "utf8");
const bookingRoute = fs.readFileSync(new URL("../app/api/booking-reports/route.ts", import.meta.url), "utf8");
const functionNames = ["normalizeHeaderKey", "headerMap", "normalizePlate", "lookupBookingListCommissionGroup"];
const functionSource = functionNames.map((name) => {
  const match = appsScript.match(new RegExp(`function ${name}\\([^\\r\\n]+`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}).join("\n");

function row(headers: string[], values: Record<string, unknown>) {
  return headers.map((header) => values[header] ?? "");
}

function lookup(headers: string[], rows: unknown[][], input: Record<string, unknown>) {
  const sheet = {
    getLastRow: () => rows.length + 1,
    getDataRange: () => ({ getValues: () => [headers, ...rows] })
  };
  const context = {
    BOOKING_LIST_SHEET_NAME: "Booking List",
    findSheet: () => sheet,
    input,
    result: undefined as unknown
  };
  vm.runInNewContext(`${functionSource};result=lookupBookingListCommissionGroup(input);`, context);
  return JSON.parse(JSON.stringify(context.result)) as CommissionGroupLookupResult;
}

const stableHeaders = ["No.", "BookingReportId", "BookingId", "SalesReportId", "ทะเบียน", "CAR GROUP", "FinalGrade"];

for (const group of ["G1", "G2", "G3"] as const) {
  test(`exact booking relationship resolves ${group}`, () => {
    const result = lookup(stableHeaders, [row(stableHeaders, { "No.": 12, BookingReportId: "BR-12", ทะเบียน: "กข 1234", "CAR GROUP": group })], { bookingReportId: "BR-12", plate: "อื่น" });
    assert.deepEqual(result, { status: "resolved", commissionGroup: group, sourceReference: "booking_list:row:2", bookingReportId: "BR-12", normalizedPlate: "อื่น" });
  });
}

test("unique normalized plate resolves, zero match does not, and duplicates conflict", () => {
  const headers = ["No.", "ทะเบียน", "CAR GROUP"];
  const rows = [
    row(headers, { "No.": 1, ทะเบียน: "1ขด 8124", "CAR GROUP": "G1" }),
    row(headers, { "No.": 2, ทะเบียน: "กข 1234", "CAR GROUP": "G2" })
  ];
  assert.equal(lookup(headers, rows, { plate: "1ขด8124" }).status, "resolved");
  assert.equal(lookup(headers, rows, { plate: "ไม่พบ" }).status, "not_found");
  assert.equal(lookup(headers, [...rows, row(headers, { "No.": 3, ทะเบียน: "1ขด8124", "CAR GROUP": "G3" })], { plate: "1ขด 8124" }).status, "conflict");
});

test("group validation trims only exact G1/G2/G3 and ignores FinalGrade", () => {
  for (const [raw, expected] of [[" G2 ", "resolved"], ["Group 1", "invalid_group"], ["Luxury", "invalid_group"], ["ABC+", "invalid_group"]]) {
    const result = lookup(stableHeaders, [row(stableHeaders, { BookingReportId: "BR-1", ทะเบียน: "A", "CAR GROUP": raw, FinalGrade: "G3" })], { bookingReportId: "BR-1" });
    assert.equal(result.status, expected);
  }
  const missing = lookup(stableHeaders, [row(stableHeaders, { BookingReportId: "BR-1", ทะเบียน: "A", "CAR GROUP": "", FinalGrade: "G3" })], { bookingReportId: "BR-1" });
  assert.equal(missing.status, "invalid_group");
});

test("lookup does not fuzzy match or select newest duplicate", () => {
  const headers = ["No.", "ทะเบียน", "CAR GROUP", "UpdatedAt"];
  const rows = [
    row(headers, { "No.": 1, ทะเบียน: "กข 1234", "CAR GROUP": "G1", UpdatedAt: "2026-01-01" }),
    row(headers, { "No.": 2, ทะเบียน: "กข 1234", "CAR GROUP": "G3", UpdatedAt: "2026-08-01" })
  ];
  assert.equal(lookup(headers, rows, { plate: "กข123" }).status, "not_found");
  assert.equal(lookup(headers, rows, { plate: "กข1234" }).status, "conflict");
});

test("Apps Script lookup implementation contains no Sheet write method", () => {
  const lookupSource = functionSource.slice(functionSource.indexOf("function lookupBookingListCommissionGroup"));
  assert.doesNotMatch(lookupSource, /\.(?:setValues|setValue|appendRow|deleteRow|insertRow|clear|sort)\s*\(/);
  assert.doesNotMatch(lookupSource, /FinalGrade|VehicleGroup|Campaign|Luxury/i);
});

test("application uses the existing server-side Apps Script transport and degrades safely", () => {
  assert.match(appsScriptService, /callAppsScript<\{ result: CommissionGroupLookupResult \}>\("lookupBookingListCommissionGroup"/);
  assert.match(bookingRoute, /await lookupBookingListCommissionGroup\(/);
  assert.match(bookingRoute, /console\.warn\("\[booking-reports\] Booking List Commission Group lookup failed"/);
  assert.doesNotMatch(bookingRoute, /NEXT_PUBLIC_|script\.google\.com/);
});

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return {
    id: "CASE-1", bookingId: "BK-1", bookingReportId: "BR-1", salesReportId: "", plate: "1ขด 8124",
    customerName: "Fixture", brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "",
    saleName: "", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "",
    bookingPrice: "", salePrice: "500000", finalPrice: "490000", centralDiscount: "10000", bookingDeduction: "",
    downPayment: "", netPayment: "", paymentType: "", deliveryDate: "", deliveryLocation: "", garageOutDate: "",
    garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    workflowStatus: "", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [],
    status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "", updatedAt: "",
    ...overrides
  };
}

for (const group of ["G1", "G2", "G3"] as const) {
  test(`resolved ${group} lookup captures canonical source and timestamp`, () => {
    const capture = commissionGroupCaptureFromLookup({ status: "resolved", commissionGroup: group, sourceReference: "booking_list:row:123" }, "2026-08-13T00:00:00Z");
    const result = applyCanonicalCommissionCapture(record(), { group: capture });
    assert.equal(result.record.commissionGroup, group);
    assert.equal(result.record.commissionGroupSource, "booking_list:row:123");
    assert.equal(result.record.commissionGroupCapturedAt, "2026-08-13T00:00:00Z");
    assert.deepEqual(result.activityActions, ["commission_group_captured"]);
  });
}

test("unresolved, conflict and invalid lookup never create canonical capture", () => {
  for (const status of ["not_found", "conflict", "invalid_group"] as const) {
    assert.equal(commissionGroupCaptureFromLookup({ status }, "2026-08-13T00:00:00Z"), undefined);
  }
});

test("existing proven group and recognized snapshot remain immutable", () => {
  const capture = commissionGroupCaptureFromLookup({ status: "resolved", commissionGroup: "G3", sourceReference: "booking_list:row:123" }, "2026-08-13T00:00:00Z");
  const existing = record({ commissionGroup: "G1", commissionGroupSource: "booking_list:row:10", commissionGroupCapturedAt: "2026-08-01T00:00:00Z" });
  assert.equal(applyCanonicalCommissionCapture(existing, { group: undefined }).record.commissionGroup, "G1");
  assert.equal(applyCanonicalCommissionCapture(existing, { group: capture, recognized: true }).record.commissionGroup, "G1");
});

test("historical records are not backfilled without an explicit capture input", () => {
  const historical = record();
  assert.deepEqual(applyCanonicalCommissionCapture(historical, {}).record, historical);
});
