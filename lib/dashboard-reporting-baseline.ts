import { readJsonStore } from "@/lib/json-store";
import type { DashboardMetrics } from "@/lib/dashboard-personal-metrics";

export const DASHBOARD_BASELINE_FILE = "dashboard-reporting-baseline-v1.json";
export const DASHBOARD_BASELINE_CUTOFF_DATE = "2026-08-26";
export const DASHBOARD_BASELINE_MONTH = "2026-08";

export type DashboardBaselineEntityType = "lead" | "booking" | "booking_delivery_cohort" | "delivery_completion";

export type DashboardReportingBaselineRecord = {
  entityType: DashboardBaselineEntityType;
  entityId: string;
  ownerUserId: string;
  reportingMonth: string;
  baseline: true;
  cutoffDate: string;
  createdAt: string;
};

export type DashboardReportingBaselineStore = {
  version: 1;
  cutoffDate: string;
  reportingMonth: string;
  records: Record<string, DashboardReportingBaselineRecord>;
};

export type DashboardBaselineMetricCounts = Omit<DashboardMetrics, "newLeadsToday" | "todayEvents">;

const EMPTY: DashboardReportingBaselineStore = {
  version: 1,
  cutoffDate: DASHBOARD_BASELINE_CUTOFF_DATE,
  reportingMonth: DASHBOARD_BASELINE_MONTH,
  records: {}
};

export function dashboardBaselineKey(entityType: DashboardBaselineEntityType, entityId: string) {
  return `${entityType}:${String(entityId || "").trim()}`;
}

export async function readDashboardReportingBaseline() {
  const store = await readJsonStore<DashboardReportingBaselineStore>(DASHBOARD_BASELINE_FILE, EMPTY);
  return store?.version === 1 && store.records && typeof store.records === "object" ? store : EMPTY;
}

export function baselineReportingMonth(
  records: Record<string, DashboardReportingBaselineRecord> | undefined,
  entityType: DashboardBaselineEntityType,
  entityId: string,
  actualDateKey: string
) {
  return records?.[dashboardBaselineKey(entityType, entityId)]?.reportingMonth || actualDateKey.slice(0, 7);
}

export function baselineMetricCounts(metrics: DashboardMetrics): DashboardBaselineMetricCounts {
  const { newLeadsToday: _todayLeads, todayEvents: _todayEvents, ...counts } = metrics;
  return counts;
}

export function subtractMetricCounts(after: DashboardBaselineMetricCounts, before: DashboardBaselineMetricCounts) {
  return Object.fromEntries(Object.keys(after).map((key) => [key, after[key as keyof DashboardBaselineMetricCounts] - before[key as keyof DashboardBaselineMetricCounts]])) as DashboardBaselineMetricCounts;
}
