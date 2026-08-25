import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function loadMetricsModule() {
  const source = (await read("lib/dashboard-personal-metrics.ts"))
    .replace(/import type[^;]+;\s*/g, "")
    .replace(/import \{ buildCalendarVehicleOptions \}[^;]+;/, "const buildCalendarVehicleOptions = (_reports, prep) => prep.map((item) => ({ bookingId: item.bookingId }));")
    .replace(/import \{ currentBangkokMonth \}[^;]+;/, "const currentBangkokMonth = () => '2026-09';");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${output}})(module.exports,module)`, { module, exports: module.exports, Intl, Date, Map, Set, Number });
  return module.exports;
}

const user = { id: "A", firstName: "Alpha", lastName: "Sales", nickname: "Alpha", email: "a@example.test", locked: false };
const booking = (id, bookingDate, createdAt, overrides = {}) => ({ id, type: "booking", bookingDate, createdAt, updatedAt: "2026-09-10T00:00:00+07:00", status: "draft", plate: "SAME", saleName: "", reportText: "", ...overrides });

test("cutoff uses the trustworthy creation instant at Bangkok midnight", async () => {
  const { DASHBOARD_REPORTING_START_DATE, isDashboardReportingEraRecord } = await loadMetricsModule();
  assert.equal(DASHBOARD_REPORTING_START_DATE, "2026-08-26");
  assert.equal(isDashboardReportingEraRecord("2026-08-25T23:59:59+07:00"), false);
  assert.equal(isDashboardReportingEraRecord("2026-08-25T16:59:59Z"), false);
  assert.equal(isDashboardReportingEraRecord("2026-08-26T00:00:00+07:00"), true);
  assert.equal(isDashboardReportingEraRecord("2026-08-25T17:00:00Z"), true);
  assert.equal(isDashboardReportingEraRecord("2026-08-26"), true);
  assert.equal(isDashboardReportingEraRecord(""), false);
});

test("old cases stay excluded while new Booking, Lead, Delivery and VehiclePrep follow canonical months", async () => {
  const { derivePersonalDashboardMetrics } = await loadMetricsModule();
  const reports = [
    booking("BR-OLD", "2026-08-31", "2026-08-25T23:59:59+07:00"),
    booking("BR-AUG", "2026-08-26", "2026-08-26T00:00:00+07:00"),
    booking("BR-SEP", "2026-09-01", "2026-09-01T00:00:00+07:00"),
    booking("SR-OLD", "2026-09-01", "2026-09-01T09:00:00+07:00", { type: "sales", bookingReportId: "BR-OLD", deliveryDate: "2026-09-03", status: "delivered" }),
    booking("SR-AUG", "2026-08-26", "2026-08-27T09:00:00+07:00", { type: "sales", bookingReportId: "BR-AUG", deliveryDate: "2026-09-03", status: "delivered" })
  ];
  const ownership = ["BR-OLD", "BR-AUG", "BR-SEP"].map((caseId) => ({ caseType: "booking", caseId, ownerUserId: "A" }));
  const bookingDeliveries = [
    { id: "BD-OLD", bookingReportId: "BR-OLD", salesReportId: "SR-OLD", bookingDate: "2026-08-31", deliveredAt: "2026-09-03T10:00:00+07:00", ownerUserId: "A", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", createdAt: "2026-09-03" },
    { id: "BD-AUG", bookingReportId: "BR-AUG", salesReportId: "SR-AUG", bookingDate: "2026-08-26", deliveredAt: "2026-09-03T10:00:00+07:00", ownerUserId: "A", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", createdAt: "2026-09-03" }
  ];
  const common = {
    targetUserId: "A", now: new Date("2026-09-03T08:00:00Z"), reports,
    prepRecords: [{ bookingId: "BR-OLD" }, { bookingId: "BR-AUG" }], bookingDeliveries,
    ownership, users: [user],
    leads: [
      { id: "L-OLD", ownerId: "A", date: "26/08/2026", createdAt: "2026-08-25T23:59:59+07:00" },
      { id: "L-AUG", ownerId: "A", date: "26/08/2026", createdAt: "2026-08-26T00:00:00+07:00" }
    ]
  };
  const august = derivePersonalDashboardMetrics({ ...common, month: "2026-08" });
  const september = derivePersonalDashboardMetrics({ ...common, month: "2026-09" });

  assert.equal(august.bookings, 1);
  assert.equal(august.leads, 1);
  assert.equal(august.bookingDeliveries, 1);
  assert.equal(august.waitingDelivery, 1);
  assert.equal(august.delivered, 0);
  assert.equal(september.bookings, 1);
  assert.equal(september.bookingDeliveries, 0);
  assert.equal(september.delivered, 1);
});

test("Dashboard no longer contains a baseline route, override, mapping, or write contract", async () => {
  const route = await read("app/api/dashboard/metrics/route.ts");
  const metrics = await read("lib/dashboard-personal-metrics.ts");
  assert.doesNotMatch(`${route}\n${metrics}`, /dashboard-reporting-baseline|baselineReportingMonth|reportingOverrides|Big\/Fai/i);
  assert.doesNotMatch(route, /writeJsonStore|compareAndSwapJsonStore/);
});

test("cache v3 is scoped and retired v1/v2 entries are removed rather than hydrated", async () => {
  const source = await read("lib/dashboard-scope.ts");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${output}})(module.exports,module)`, { module, exports: module.exports, Intl, Date });
  const keys = ["bigcar-dashboard-last-good", "bigcar-dashboard-last-good:v1:A:A:2026-08", "bigcar-dashboard-last-good:v2:A:A:2026-08", "unrelated"];
  const removed = [];
  const storage = { get length() { return keys.length; }, key: (index) => keys[index] || null, removeItem: (key) => removed.push(key) };
  module.exports.clearRetiredDashboardCaches(storage);
  assert.deepEqual(Array.from(removed), keys.slice(0, 3));
  assert.equal(module.exports.dashboardCacheKey("ADMIN", "A", "2026-08"), "bigcar-dashboard-last-good:v3:ADMIN:A:2026-08");
});
