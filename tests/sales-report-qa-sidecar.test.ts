import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assessCommissionCandidate } from "../lib/commission.ts";
import { buildSalesReportQaMetricsBaseline } from "../lib/sales-report-qa-baseline.ts";
import {
  applySalesReportQaPolicy,
  finalizeSalesReportQaMetadata,
  getSalesReportQaMetadata,
  reserveSalesReportQaMetadata,
  resolveSalesReportQaRequest,
  SALES_REPORT_QA_CREATE_MODE
} from "../lib/sales-report-qa-metadata.ts";
import type { BookingDeliveryRecord, ReportHistoryItem } from "../lib/types.ts";

const report = (id: string, bookingReportId: string): ReportHistoryItem => ({
  id, type: "sales", bookingReportId, createdAt: "2026-08-24", updatedAt: "2026-08-24", status: "draft",
  customerName: "นายก", phone: "", idCard: "", plate: "1กก 1234", brand: "", model: "", year: "", color: "",
  saleName: "ฐากร", teamName: "", emailSubject: "", emailTo: "", emailCc: "", emailStatus: "", lineStatus: "",
  ocrStatus: "", emailDraftId: "", driveFolderUrl: "", attachments: [], reportText: ""
});

const delivery = (overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord => ({
  id: "BD-QA", bookingId: "BK-QA", bookingReportId: "BR-QA", salesReportId: "SR-QA", plate: "1กก 1234",
  customerName: "นายก", brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "ฐากร",
  teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "",
  finalPrice: "", centralDiscount: "", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "",
  deliveryDate: "", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false,
  oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false,
  financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "รอส่งมอบ", statusSource: "auto",
  summary: "", alertSummary: "", cancelReason: "", createdAt: "2026-08-24", updatedAt: "2026-08-24", isCounted: true,
  ...overrides
});

test("Sales QA mode is admin-only and server-forces exclusion metadata", () => {
  const request = { qaCreateMode: SALES_REPORT_QA_CREATE_MODE, qaTestMarker: "QA-BOOKING-SALES-DELIVERY-20260824-A", bookingReportId: "BR-A", requestId: "REQ-A" };
  assert.throws(() => resolveSalesReportQaRequest({ id: "sales", role: "sales" }, request), /Admin access required/);
  const forced = resolveSalesReportQaRequest({ id: "admin", role: "admin" }, request);
  assert.deepEqual({ qaTestRecord: forced?.qaTestRecord, excludeFromMetrics: forced?.excludeFromMetrics, isCounted: forced?.isCounted }, { qaTestRecord: true, excludeFromMetrics: true, isCounted: false });
  assert.equal(resolveSalesReportQaRequest({ id: "sales", role: "sales" }, { requestId: "REQ", bookingReportId: "BR-A" }), undefined);
});

test("sidecar reserves fail-closed, finalizes by salesReportId, and operational reads exclude QA", async () => {
  const previousDir = process.env.BIG_CAR_DATA_DIR;
  const previousProvider = process.env.BIG_CAR_STORE_PROVIDER;
  const dir = await mkdtemp(path.join(os.tmpdir(), "sales-qa-sidecar-"));
  process.env.BIG_CAR_DATA_DIR = dir;
  process.env.BIG_CAR_STORE_PROVIDER = "json";
  try {
    const pending = resolveSalesReportQaRequest({ id: "admin", role: "super_admin" }, { qaCreateMode: SALES_REPORT_QA_CREATE_MODE, qaTestMarker: "QA-BOOKING-SALES-DELIVERY-20260824-A", bookingReportId: "BR-A", requestId: "REQ-A" })!;
    await reserveSalesReportQaMetadata(pending);
    assert.deepEqual(await applySalesReportQaPolicy([report("SR-A", "BR-A")]), []);
    await finalizeSalesReportQaMetadata("REQ-A", "SR-A");
    assert.equal((await getSalesReportQaMetadata("SR-A"))?.sourceBookingReportId, "BR-A");
    assert.deepEqual(await applySalesReportQaPolicy([report("SR-A", "BR-A")]), []);
    const audit = await applySalesReportQaPolicy([report("SR-A", "BR-A")], { includeExcluded: true });
    assert.equal(audit[0].qaTestRecord, true);
    assert.equal(audit[0].isCounted, false);
  } finally {
    if (previousDir === undefined) delete process.env.BIG_CAR_DATA_DIR; else process.env.BIG_CAR_DATA_DIR = previousDir;
    if (previousProvider === undefined) delete process.env.BIG_CAR_STORE_PROVIDER; else process.env.BIG_CAR_STORE_PROVIDER = previousProvider;
    await rm(dir, { recursive: true, force: true });
  }
});

test("QA Booking Delivery is excluded from RDD metrics and Commission regardless of otherwise valid inputs", () => {
  const operational = delivery({ id: "BD-OP", bookingReportId: "BR-OP", salesReportId: "SR-OP", commissionGroup: "G1", deliveredAt: "2026-08-24", caseStatus: "delivered" });
  const qa = delivery({ qaTestRecord: true, excludeFromMetrics: true, isCounted: false, commissionGroup: "G1", deliveredAt: "2026-08-24", caseStatus: "delivered" });
  const baseline = buildSalesReportQaMetricsBaseline({ reports: [report("SR-OP", "BR-OP")], bookingDeliveries: [operational, qa], year: 2026, month: 8 });
  assert.equal(baseline.salesReports, 1);
  assert.equal(baseline.bookingDeliveries, 1);
  assert.equal(assessCommissionCandidate(qa, { "ฐากร": "USER-1" }).state, "excluded");
});

test("create sequencing persists QA exclusion before downstream sync and normal UI exposes no QA controls", async () => {
  const route = await readFile(new URL("../app/api/sales-reports/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/sales-reports/page.tsx", import.meta.url), "utf8");
  const bookingDelivery = await readFile(new URL("../lib/booking-delivery.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/api/dashboard/metrics/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("reserveSalesReportQaMetadata") < route.indexOf("saveSalesReport(report"));
  assert.ok(route.indexOf("await finalizeSalesReportQaMetadata") < route.indexOf("await syncBookingDeliveryFromReportHistory"));
  assert.match(route, /downstream processing stopped/);
  assert.doesNotMatch(page, /qaCreateMode|qaTestMarker|excludeFromMetrics/);
  assert.match(bookingDelivery, /includeExcluded: true/);
  assert.match(bookingDelivery, /sales\?\.qaTestRecord/);
  assert.match(bookingDelivery, /sales\?\.isCounted === false/);
  assert.match(dashboard, /operationalBookingDeliveries/);
  assert.doesNotMatch(route, /stock.*(?:write|update|save)/i);
});
