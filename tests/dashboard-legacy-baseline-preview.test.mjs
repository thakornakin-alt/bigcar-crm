import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function compile(source, globals = {}) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${output}})(module.exports,module)`, { module, exports: module.exports, Intl, Date, Map, Set, Object, ...globals });
  return module.exports;
}

async function loadMetricFunctions() {
  const source = (await read("lib/dashboard-personal-metrics.ts"))
    .replace(/import type[^;]+;\s*/g, "")
    .replace(/import \{ buildCalendarVehicleOptions \}[^;]+;/, "const buildCalendarVehicleOptions = (_reports, prep) => prep.map((item) => ({ bookingId: item.bookingId }));")
    .replace(/import \{ currentBangkokMonth \}[^;]+;/, "const currentBangkokMonth = () => '2026-08';")
    .replace(/import \{ baselineReportingMonth,[^;]+;/s, "const baselineReportingMonth = (records, entityType, entityId, actualDateKey) => records?.[entityType + ':' + entityId]?.reportingMonth || actualDateKey.slice(0, 7);");
  return compile(source);
}

async function loadPreviewBuilder() {
  const metrics = await loadMetricFunctions();
  const baselineSource = (await read("lib/dashboard-reporting-baseline.ts"))
    .replace(/import \{ readJsonStore \}[^;]+;/, "const readJsonStore = async (_file, fallback) => fallback;")
    .replace(/import type[^;]+;\s*/g, "");
  const baseline = compile(baselineSource);
  const previewSource = (await read("lib/dashboard-reporting-baseline-preview.ts"))
    .replace(/import type[^;]+;\s*/g, "")
    .replace(/import \{ businessDateKey, derivePersonalDashboardMetrics \}[^;]+;/, "const { businessDateKey, derivePersonalDashboardMetrics } = globalThis.__deps;")
    .replace(/import \{[\s\S]*?\} from "@\/lib\/dashboard-reporting-baseline";/, "const { DASHBOARD_BASELINE_CUTOFF_DATE, DASHBOARD_BASELINE_MONTH, baselineMetricCounts, dashboardBaselineKey, subtractMetricCounts } = globalThis.__deps;");
  return compile(previewSource, { __deps: { ...metrics, ...baseline } });
}

const user = (id, name) => ({ id, firstName: name, lastName: "Sales", nickname: name, email: `${id}@example.test`, role: "sales", locked: false, branch: "" });
const report = (id, bookingDate, overrides = {}) => ({ id, type: "booking", bookingDate, createdAt: `${bookingDate}T00:00:00+07:00`, updatedAt: `${bookingDate}T00:00:00+07:00`, status: "draft", saleName: "", reportText: "", plate: "SAME", ...overrides });

test("preview is admin-only GET and exposes no baseline apply/write action", async () => {
  const route = await read("app/api/admin/dashboard-reporting-baseline-preview/route.ts");
  const baseline = await read("lib/dashboard-reporting-baseline.ts");
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /await requireAdmin\(\)/);
  assert.doesNotMatch(route, /export async function (POST|PATCH|PUT|DELETE)/);
  assert.doesNotMatch(`${route}\n${baseline}`, /writeJsonStore|compareAndSwapJsonStore/);
  assert.match(baseline, /dashboard-reporting-baseline-v1\.json/);
});

test("preview maps only stable pre-cutoff entities and separates delivery cohort from completion", async () => {
  const { buildDashboardReportingBaselinePreview } = await loadPreviewBuilder();
  const users = [user("A", "Alpha"), user("B", "Beta")];
  const reports = [
    report("BR-PRE", "2026-07-10"),
    report("BR-POST", "2026-08-26"),
    report("BR-NAME-ONLY", "2026-06-01", { saleName: "Beta Sales" }),
    report("BR-QA", "2026-05-01", { qaTestRecord: true, excludeFromMetrics: true, isCounted: false }),
    report("SR-LATE", "2026-07-10", { type: "sales", bookingReportId: "BR-PRE", deliveryDate: "2026-09-01", status: "delivered" })
  ];
  const bookingDeliveries = [
    { id: "BD-LATE", bookingReportId: "BR-PRE", salesReportId: "SR-LATE", bookingDate: "2026-07-10", deliveredAt: "2026-09-01T10:00:00+07:00", ownerUserId: "A", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", createdAt: "2026-07-10" },
    { id: "BD-PRE", bookingReportId: "BR-PRE", salesReportId: "", bookingDate: "2026-07-11", deliveredAt: "2026-07-20T10:00:00+07:00", ownerUserId: "A", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", createdAt: "2026-07-11" }
  ];
  const leads = [{ id: "L-A", ownerId: "A", date: "01/07/2026", createdAt: "2026-07-01" }, { id: "L-UNKNOWN", ownerId: "", date: "01/07/2026", createdAt: "2026-07-01" }];
  const original = JSON.stringify({ reports, bookingDeliveries, leads });
  const preview = buildDashboardReportingBaselinePreview({ leads, reports, prepRecords: [], bookingDeliveries, ownership: [{ caseType: "booking", caseId: "BR-PRE", ownerUserId: "A" }, { caseType: "booking", caseId: "BR-POST", ownerUserId: "A" }], users, existing: { version: 1, cutoffDate: "2026-08-26", reportingMonth: "2026-08", records: {} }, generatedAt: "2026-08-26T00:00:00+07:00" });
  const keys = new Set(preview.proposedRecords.map((item) => `${item.entityType}:${item.entityId}`));
  assert.ok(keys.has("lead:L-A"));
  assert.ok(keys.has("booking:BR-PRE"));
  assert.ok(keys.has("booking_delivery_cohort:BD-LATE"));
  assert.ok(!keys.has("delivery_completion:BD-LATE"));
  assert.ok(keys.has("booking_delivery_cohort:BD-PRE"));
  assert.ok(keys.has("delivery_completion:BD-PRE"));
  assert.ok(!keys.has("booking:BR-POST"));
  assert.ok(!keys.has("booking:BR-NAME-ONLY"));
  assert.ok(!keys.has("booking:BR-QA"));
  assert.ok(preview.summary.unresolvedRecords >= 2);
  assert.equal(JSON.stringify({ reports, bookingDeliveries, leads }), original);
});

test("reporting override changes Dashboard month only and preserves post-cutoff actual dates", async () => {
  const { derivePersonalDashboardMetrics } = await loadMetricFunctions();
  const users = [user("A", "Alpha")];
  const reports = [report("BR-OLD", "2026-07-01"), report("BR-AUG", "2026-08-26"), report("BR-SEP", "2026-09-01")];
  const ownership = reports.map((item) => ({ caseType: "booking", caseId: item.id, ownerUserId: "A" }));
  const records = { "booking:BR-OLD": { entityType: "booking", entityId: "BR-OLD", ownerUserId: "A", reportingMonth: "2026-08", baseline: true, cutoffDate: "2026-08-26", createdAt: "2026-08-26" } };
  const input = { targetUserId: "A", leads: [], prepRecords: [], bookingDeliveries: [], ownership, users, reports, reportingOverrides: records };
  assert.equal(derivePersonalDashboardMetrics({ ...input, month: "2026-08" }).bookings, 2);
  assert.equal(derivePersonalDashboardMetrics({ ...input, month: "2026-09" }).bookings, 1);
  assert.equal(reports[0].bookingDate, "2026-07-01");
});
