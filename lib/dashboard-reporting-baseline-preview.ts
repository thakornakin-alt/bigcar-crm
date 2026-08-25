import type { CaseOwnership } from "@/lib/case-ownership";
import { businessDateKey, derivePersonalDashboardMetrics } from "@/lib/dashboard-personal-metrics";
import {
  DASHBOARD_BASELINE_CUTOFF_DATE,
  DASHBOARD_BASELINE_MONTH,
  baselineMetricCounts,
  dashboardBaselineKey,
  subtractMetricCounts,
  type DashboardBaselineEntityType,
  type DashboardReportingBaselineRecord,
  type DashboardReportingBaselineStore
} from "@/lib/dashboard-reporting-baseline";
import type { SalesLead } from "@/lib/leads";
import type { BookingDeliveryRecord, ReportHistoryItem, SalesUser } from "@/lib/types";
import type { VehiclePrepRecord } from "@/lib/vehicle-prep";

type PreviewInput = {
  leads: SalesLead[];
  reports: ReportHistoryItem[];
  prepRecords: VehiclePrepRecord[];
  bookingDeliveries: BookingDeliveryRecord[];
  ownership: CaseOwnership[];
  users: SalesUser[];
  existing: DashboardReportingBaselineStore;
  generatedAt?: string;
};

function operationalReport(report: ReportHistoryItem) {
  return report.status !== "deleted" && report.qaTestRecord !== true && report.excludeFromMetrics !== true && report.isCounted !== false;
}

function operationalDelivery(record: BookingDeliveryRecord) {
  return record.qaTestRecord !== true && record.excludeFromMetrics !== true && record.isCounted !== false;
}

function deliveryActualDate(record: BookingDeliveryRecord, sales?: ReportHistoryItem) {
  return businessDateKey(record.deliveredAt) || businessDateKey(record.deliveryDate) || businessDateKey(sales?.deliveryDate) || businessDateKey(record.createdAt);
}

export function buildDashboardReportingBaselinePreview(input: PreviewInput) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const users = input.users.filter((user) => !user.locked && user.role !== "viewer");
  const validUserIds = new Set(users.map((user) => user.id));
  const ownershipByCase = new Map(input.ownership.map((item) => [`${item.caseType}:${item.caseId}`, item.ownerUserId]));
  const activeReports = input.reports.filter(operationalReport);
  const bookings = activeReports.filter((report) => report.type === "booking");
  const sales = activeReports.filter((report) => report.type === "sales");
  const bookingById = new Map(bookings.map((report) => [report.id, report]));
  const salesById = new Map(sales.map((report) => [report.id, report]));
  const stableBookingOwner = (report: ReportHistoryItem) => {
    const owner = String(ownershipByCase.get(`booking:${report.id}`) || (report as ReportHistoryItem & { salespersonUserId?: string }).salespersonUserId || "").trim();
    return validUserIds.has(owner) ? owner : "";
  };
  const stableDeliveryOwner = (record: BookingDeliveryRecord) => {
    const booking = bookingById.get(String(record.bookingReportId || "").trim());
    const owner = String(record.ownerUserId || (booking ? stableBookingOwner(booking) : "") || record.salespersonUserId || "").trim();
    return validUserIds.has(owner) ? owner : "";
  };

  const proposed: Record<string, DashboardReportingBaselineRecord> = {};
  const eligibleEntriesByUser = new Map<string, number>();
  const eligibleRecordsByUser = new Map<string, Set<string>>();
  const alreadyMappedByUser = new Map<string, number>();
  const unresolvedByUser = new Map<string, Set<string>>();
  const unresolvedGlobal = new Set<string>();
  const unresolvedReasons: Record<string, number> = { owner_unresolved: 0, date_unresolved: 0 };

  const consider = (entityType: DashboardBaselineEntityType, entityId: string, ownerUserId: string, actualDate: string, physicalKey: string) => {
    if (!actualDate) {
      unresolvedReasons.date_unresolved += 1;
      if (ownerUserId) {
        const set = unresolvedByUser.get(ownerUserId) || new Set<string>();
        set.add(physicalKey);
        unresolvedByUser.set(ownerUserId, set);
      } else unresolvedGlobal.add(physicalKey);
      return;
    }
    if (actualDate >= DASHBOARD_BASELINE_CUTOFF_DATE) return;
    if (!ownerUserId) {
      unresolvedReasons.owner_unresolved += 1;
      unresolvedGlobal.add(physicalKey);
      return;
    }
    eligibleEntriesByUser.set(ownerUserId, (eligibleEntriesByUser.get(ownerUserId) || 0) + 1);
    const eligibleRecords = eligibleRecordsByUser.get(ownerUserId) || new Set<string>();
    eligibleRecords.add(physicalKey);
    eligibleRecordsByUser.set(ownerUserId, eligibleRecords);
    const key = dashboardBaselineKey(entityType, entityId);
    if (input.existing.records[key]) {
      alreadyMappedByUser.set(ownerUserId, (alreadyMappedByUser.get(ownerUserId) || 0) + 1);
      return;
    }
    proposed[key] = { entityType, entityId, ownerUserId, reportingMonth: DASHBOARD_BASELINE_MONTH, baseline: true, cutoffDate: DASHBOARD_BASELINE_CUTOFF_DATE, createdAt: generatedAt };
  };

  for (const lead of input.leads) {
    const owner = validUserIds.has(String(lead.ownerId || "").trim()) ? String(lead.ownerId).trim() : "";
    consider("lead", lead.id, owner, businessDateKey(lead.date) || businessDateKey(lead.createdAt), `lead:${lead.id}`);
  }
  for (const booking of bookings) {
    consider("booking", booking.id, stableBookingOwner(booking), businessDateKey(booking.bookingDate) || businessDateKey(booking.createdAt), `booking:${booking.id}`);
  }
  for (const record of input.bookingDeliveries.filter(operationalDelivery)) {
    const owner = stableDeliveryOwner(record);
    consider("booking_delivery_cohort", record.id, owner, businessDateKey(record.bookingDate) || businessDateKey(record.createdAt), `booking_delivery:${record.id}`);
    const delivered = record.status === "ยอดส่งมอบ" || record.workflowStatus === "ยอดส่งมอบ" || record.caseStatus === "delivered";
    if (delivered) consider("delivery_completion", record.id, owner, deliveryActualDate(record, salesById.get(record.salesReportId)), `booking_delivery:${record.id}`);
  }

  const afterRecords = { ...input.existing.records, ...proposed };
  const bySalesperson = users.map((user) => {
    const metricInput = { targetUserId: user.id, month: DASHBOARD_BASELINE_MONTH, leads: input.leads, reports: input.reports, prepRecords: input.prepRecords, bookingDeliveries: input.bookingDeliveries, ownership: input.ownership, users: input.users };
    const current = baselineMetricCounts(derivePersonalDashboardMetrics({ ...metricInput, reportingOverrides: input.existing.records }));
    const afterBaseline = baselineMetricCounts(derivePersonalDashboardMetrics({ ...metricInput, reportingOverrides: afterRecords }));
    const proposedForUser = Object.values(proposed).filter((record) => record.ownerUserId === user.id);
    const proposedPhysicalRecords = new Set(proposedForUser.map((record) => record.entityType === "lead" ? `lead:${record.entityId}` : record.entityType === "booking" ? `booking:${record.entityId}` : `booking_delivery:${record.entityId}`));
    return {
      userId: user.id,
      displayName: user.nickname || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
      branch: user.branch || "",
      historicalRecordsEligible: eligibleRecordsByUser.get(user.id)?.size || 0,
      eligibleReportingEntries: eligibleEntriesByUser.get(user.id) || 0,
      recordsEnteringAugustBaseline: proposedPhysicalRecords.size,
      baselineEntriesToCreate: proposedForUser.length,
      alreadyMapped: alreadyMappedByUser.get(user.id) || 0,
      unresolvedRecords: unresolvedByUser.get(user.id)?.size || 0,
      currentAugustMetrics: current,
      afterBaselineMetrics: afterBaseline,
      baselineAddedByMetric: subtractMetricCounts(afterBaseline, current)
    };
  });

  return {
    mode: "read_only_preview" as const,
    cutoffDate: DASHBOARD_BASELINE_CUTOFF_DATE,
    reportingMonth: DASHBOARD_BASELINE_MONTH,
    generatedAt,
    summary: {
      historicalRecordsEligible: Array.from(eligibleRecordsByUser.values()).reduce((sum, set) => sum + set.size, 0),
      eligibleReportingEntries: Array.from(eligibleEntriesByUser.values()).reduce((sum, value) => sum + value, 0),
      baselineEntriesToCreate: Object.keys(proposed).length,
      alreadyMapped: Array.from(alreadyMappedByUser.values()).reduce((sum, value) => sum + value, 0),
      unresolvedRecords: unresolvedGlobal.size + Array.from(unresolvedByUser.values()).reduce((sum, set) => sum + set.size, 0),
      unresolvedReasons
    },
    bySalesperson,
    proposedRecords: Object.values(proposed)
  };
}
