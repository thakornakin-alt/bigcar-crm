import assert from "node:assert/strict";
import test from "node:test";
import { applyQaSyntheticCreateMetadata, resolveQaSyntheticCreateMetadata } from "../lib/qa-synthetic-create.ts";
import { bookingFoundationFromReport } from "../lib/booking-delivery-foundation.ts";
import { adaptBookingDeliveryToCommissionCandidate } from "../lib/commission-candidate.ts";
import type { BookingDeliveryRecord, SalesUserRole } from "../lib/types.ts";

const marker = "BR-COM2C2-E2E-20260818-001";

function resolve(role: SalesUserRole, overrides: Record<string, unknown> = {}) {
  return resolveQaSyntheticCreateMetadata({ role }, {
    qaCreateMode: "commission_synthetic_e2e",
    qaTestMarker: marker,
    ...overrides
  });
}

test("authorized QA create forces all exclusion flags", () => {
  assert.deepEqual(resolve("admin", {
    qaTestRecord: false,
    excludeFromMetrics: false,
    isCounted: true
  }), {
    qaTestRecord: true,
    excludeFromMetrics: true,
    isCounted: false,
    qaTestMarker: marker
  });
  assert.equal(resolve("super_admin")?.isCounted, false);
});

test("ordinary Sales cannot enter QA create mode", () => {
  assert.throws(() => resolve("sales"), /Admin access required/);
  assert.throws(() => resolve("viewer"), /Admin access required/);
});

test("ordinary create ignores loose client QA fields and retains normal foundation", () => {
  assert.equal(resolveQaSyntheticCreateMetadata({ role: "sales" }, {
    qaTestRecord: true,
    excludeFromMetrics: true,
    isCounted: false
  } as Record<string, unknown>), undefined);
  assert.equal(bookingFoundationFromReport("2026-08-18").isCounted, true);
});

function qaRecord(): BookingDeliveryRecord {
  return {
    id: "QA-COM-1", bookingId: "QA-COM-1", bookingReportId: "QA-COM-1", salesReportId: "",
    plate: "QA-COM2C2-G3-001", customerName: "QA", brand: "", model: "", year: "", color: "",
    engineNo: "", chassisNo: "", saleName: "QA", teamName: "", teamId: "", source: "", ownership: "",
    project: "", campaign: "", bookingPrice: "0", bookingDeduction: "0", downPayment: "0", netPayment: "0",
    paymentType: "cash", salePrice: "500000", finalPrice: "500000", centralDiscount: "0",
    deliveryLocation: "", deliveryDate: "2026-08-20", garageOutDate: "", garageReturnDate: "",
    spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [],
    workflowStatus: "รอส่งมอบ", status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "",
    createdAt: "2026-08-18T00:00:00.000Z", updatedAt: "2026-08-18T00:00:00.000Z",
    purchaseType: "cash", caseStatus: "waiting_delivery", commissionGroup: "G3",
    salespersonUserId: "USER-QA", qaTestRecord: true, excludeFromMetrics: true, isCounted: false,
    batteryStatus: "not_checked"
  };
}

test("QA synthetic record is excluded from Commission", () => {
  const record = qaRecord();
  const candidate = adaptBookingDeliveryToCommissionCandidate(record);
  assert.equal(candidate.quality, "EXCLUDED");
  assert.equal(candidate.recognitionState, "recognition_blocked");
});

test("QA metadata is forced on the canonical record before persistence", () => {
  const record = qaRecord();
  record.qaTestRecord = undefined;
  record.excludeFromMetrics = undefined;
  record.isCounted = true;
  const persisted = applyQaSyntheticCreateMetadata(record, resolve("admin"));
  assert.equal(persisted.qaTestRecord, true);
  assert.equal(persisted.excludeFromMetrics, true);
  assert.equal(persisted.isCounted, false);
  assert.equal(persisted.qaTestMarker, marker);
});
