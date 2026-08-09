import test from "node:test";
import assert from "node:assert/strict";
import { resolveCaseDocumentManifest } from "../lib/rdd-case-documents.ts";
import { auditQaRecords, classifyQaRecord } from "../lib/rdd-qa-audit.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return {
    id: "CASE-1", bookingId: "BK-1", bookingReportId: "BR-1", salesReportId: "", plate: "กก 1", customerName: "ลูกค้า",
    brand: "Toyota", model: "Model", year: "2025", color: "ขาว", engineNo: "", chassisNo: "", saleName: "เซลล์", teamName: "", teamId: "",
    source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "", finalPrice: "", centralDiscount: "", bookingDeduction: "",
    downPayment: "", netPayment: "", paymentType: "", deliveryDate: "", deliveryLocation: "", garageOutDate: "", garageReturnDate: "",
    spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "", financeCaseSubmitted: false,
    financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "",
    cancelReason: "", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", ...overrides
  };
}

test("document manifest prefers stable report IDs and handles missing documents", () => {
  const manifest = resolveCaseDocumentManifest(record({ bookingReportId: "BR-STABLE", salesReportId: "SR-STABLE", financeAttachmentIds: ["FILE-1"] }));
  assert.equal(manifest.caseId, "CASE-1");
  assert.equal(manifest.items.find((item) => item.kind === "booking_report")?.sourceId, "BR-STABLE");
  assert.equal(manifest.items.find((item) => item.kind === "sales_report")?.sourceId, "SR-STABLE");
  assert.equal(manifest.items.find((item) => item.kind === "purchase_contract")?.available, false);
  assert.equal(manifest.items.find((item) => item.kind === "case_attachment")?.fileCount, 1);
});

test("manifest resolution is isolated to the supplied case and accepts no client file list", () => {
  const first = resolveCaseDocumentManifest(record({ id: "CASE-A", bookingReportId: "BR-A", financeAttachmentIds: ["A"] }));
  const second = resolveCaseDocumentManifest(record({ id: "CASE-B", bookingReportId: "BR-B", financeAttachmentIds: ["B", "C"] }));
  assert.equal(first.caseId, "CASE-A");
  assert.equal(first.items.find((item) => item.kind === "booking_report")?.sourceId, "BR-A");
  assert.equal(first.items.find((item) => item.kind === "case_attachment")?.fileCount, 1);
  assert.equal(second.items.find((item) => item.kind === "case_attachment")?.fileCount, 2);
});

test("QA audit is read-only and requires corroboration for a plausible Thai test-name record", () => {
  const qa = record({ id: "QA-1", plate: "TESTPV-A1", customerName: "TEST QA", brand: "TEST", source: "TEST" });
  const ambiguous = record({ id: "BR-REAL-SHAPE", customerName: "ทดสอบ", plate: "3ฒฆ 4927", brand: "TOYOTA", model: "HILUX REVO" });
  const before = structuredClone([qa, ambiguous]);
  assert.equal(classifyQaRecord(qa)?.confidence, "confirmed");
  assert.equal(classifyQaRecord(ambiguous)?.confidence, "needs_human_confirmation");
  assert.equal(auditQaRecords([qa, ambiguous]).length, 2);
  assert.deepEqual([qa, ambiguous], before);
  assert.equal("qaTestRecord" in qa, false);
  assert.equal("excludeFromMetrics" in qa, false);
});
