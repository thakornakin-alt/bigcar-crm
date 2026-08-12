import { commissionCandidateReadiness, type CommissionBookingListSource, type CommissionCandidateSources } from "@/lib/commission-candidate";
import type { BookingDeliveryRecord, SalesUser } from "@/lib/types";

function record(id: string, overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return {
    id, bookingId: `BK-${id}`, bookingReportId: `BR-${id}`, salesReportId: `SR-${id}`,
    plate: `FIXTURE ${id.slice(-2)}`, customerName: "Fixture", brand: "TOYOTA", model: "REVO", year: "2021", color: "", engineNo: "", chassisNo: "",
    saleName: "ฐากร กาญจนอังกูร", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "",
    bookingPrice: "", salePrice: "500000", finalPrice: "490000", centralDiscount: "10000", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "",
    deliveryDate: "2026-08-15", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "รอส่งมอบ", statusSource: "auto",
    summary: "", alertSummary: "", cancelReason: "", createdAt: "2026-08-01", updatedAt: "2026-08-01", isCounted: true, caseStatus: "waiting_delivery", ...overrides
  };
}

const salesUsers: SalesUser[] = [
  { id: "USER-PREVIEW-BIG", createdAt: "", updatedAt: "", email: "preview@example.test", firstName: "ฐากร", lastName: "กาญจนอังกูร", nickname: "บิ๊ก", phone: "", lineId: "", lineQrUrl: "", avatarUrl: "", position: "Sales", branch: "บางนา", role: "sales", locked: false }
];

const records = [
  record("CANON-READY", { salespersonUserId: "USER-PREVIEW-BIG", commissionGroup: "G1", caseStatus: "delivered", status: "ยอดส่งมอบ", deliveredAt: "2026-08-10T12:00:00+07:00" }),
  record("CANON-WORK", { commissionGroup: "G2" }),
  record("CANON-NOGROUP", { plate: "GROUP MISSING" }),
  record("CANON-NOSALE", { saleName: "ชื่อที่ไม่มีใน SalesUsers", commissionGroup: "G1" }),
  record("CANON-NOPRICE", { commissionGroup: "G1", salePrice: "", finalPrice: "", centralDiscount: "" }),
  record("CANON-QA", { commissionGroup: "G1", qaTestRecord: true, excludeFromMetrics: true }),
  record("CANON-CANCEL", { commissionGroup: "G1", caseStatus: "cancelled", status: "ยกเลิก" }),
  record("CANON-DUPLICATE", { plate: "กข 1234" })
];

const bookingList: CommissionBookingListSource[] = [
  { rowRef: "Booking List row 101", bookingCaseId: "CANON-NOGROUP", plate: "GROUP MISSING", commissionGroup: "G3", standardPrice: 500000 },
  { rowRef: "Booking List row 201", plate: "กข1234", commissionGroup: "G1", standardPrice: 500000 },
  { rowRef: "Booking List row 202", plate: "กข 1234", commissionGroup: "G2", standardPrice: 500000 }
];

export const COMMISSION_CANDIDATE_FIXTURE_SOURCES: CommissionCandidateSources = { salesUsers, bookingList };
export const COMMISSION_CANDIDATE_FIXTURE_RECORDS = records;

export function commissionCandidateFixtureReadiness() {
  return commissionCandidateReadiness(records, COMMISSION_CANDIDATE_FIXTURE_SOURCES);
}
