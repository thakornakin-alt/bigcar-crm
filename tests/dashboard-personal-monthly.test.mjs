import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function loadMetricsModule() {
  const source = (await read("lib/dashboard-personal-metrics.ts"))
    .replace(/import type[^;]+;\s*/g, "")
    .replace(/import \{ buildCalendarVehicleOptions \}[^;]+;/, "const buildCalendarVehicleOptions = (_reports, prep) => prep.map((item) => ({ bookingId: item.bookingId }));")
    .replace(/import \{ currentBangkokMonth \}[^;]+;/, "const currentBangkokMonth = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(now).filter(p => p.type === 'year' || p.type === 'month').map(p => p.value).join('-');");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${output}})(module.exports,module)`, { module, exports: module.exports, Intl, Date, Map, Set });
  return module.exports;
}

test("dashboard metrics fail closed and enforce personal/admin target authorization", async () => {
  const route = await read("app/api/dashboard/metrics/route.ts");
  assert.match(route, /const actor = await requireUser\(\)/);
  assert.match(route, /requestedUserId && !canSelectUser && requestedUserId !== actor\.id/);
  assert.match(route, /status: 403/);
  assert.doesNotMatch(route, /getRequestSalesUser/);
  assert.doesNotMatch(route, /currentUser = null/);
  assert.match(route, /actor\.role === "admin" \|\| actor\.role === "super_admin"/);
});

test("dashboard API returns safe personal scope and a minimal admin selector", async () => {
  const route = await read("app/api/dashboard/metrics/route.ts");
  assert.match(route, /mode: "personal"/);
  assert.match(route, /targetUserId/);
  assert.match(route, /targetDisplayName/);
  assert.match(route, /sessionUserId: actor\.id/);
  assert.match(route, /\{ id: user\.id, displayName:/);
  for (const secret of ["password", "verifier", "salt", "tokenHash"]) assert.doesNotMatch(route, new RegExp(secret, "i"));
});

test("all dashboard cohorts use stable owner and selected month; calendar total is suppressed", async () => {
  const metrics = await read("lib/dashboard-personal-metrics.ts");
  assert.match(metrics, /ownershipByCase\.get\(`booking:\$\{report\.id\}`\)/);
  assert.match(metrics, /ownershipByCase\.get\(`sales:\$\{report\.id\}`\)/);
  assert.match(metrics, /record\.ownerUserId/);
  assert.match(metrics, /record\.salespersonUserId/);
  assert.match(metrics, /record\.bookingReportId && bookingById\.get/);
  assert.match(metrics, /lead\.ownerId === targetUserId/);
  assert.match(metrics, /reportDate\(report\)\.slice\(0, 7\) === month/);
  assert.match(metrics, /todayEvents: 0/);
  assert.doesNotMatch(metrics, /plate.*owner|owner.*plate/i);
});

test("Bangkok date and business-date priority cover month boundaries", async () => {
  const metrics = await read("lib/dashboard-personal-metrics.ts");
  assert.match(metrics, /timeZone: BANGKOK/);
  assert.match(metrics, /businessDateKey\(report\.bookingDate\) \|\| businessDateKey\(report\.createdAt\)/);
  assert.match(metrics, /record\.deliveredAt.*record\.deliveryDate.*sales\?\.deliveryDate.*record\.createdAt/s);
  assert.match(metrics, /month > current/);
});

test("QA exclusions and scoped v2 last-good cache prevent cross-user/month leakage", async () => {
  const metrics = await read("lib/dashboard-personal-metrics.ts");
  const scope = await read("lib/dashboard-scope.ts");
  const page = await read("app/dashboard/page.tsx");
  for (const rule of ["qaTestRecord !== true", "excludeFromMetrics !== true", "isCounted !== false"]) assert.match(metrics, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(scope, /bigcar-dashboard-last-good:v2:\$\{sessionUserId\}:\$\{targetUserId\}:\$\{month\}/);
  assert.match(page, /sessionStorage\.removeItem\("bigcar-dashboard-last-good"\)/);
  assert.match(page, /dashboardCacheKey\(salesProfile\.id, effectiveTarget, month\)/);
});

test("Dashboard adds compact month and admin-person controls without changing metric cards", async () => {
  const page = await read("app/dashboard/page.tsx");
  assert.match(page, /ข้อมูลของ/);
  assert.match(page, /ดูข้อมูลของ/);
  assert.match(page, /aria-label="เดือนก่อน"/);
  assert.match(page, /aria-label="เดือนถัดไป"/);
  for (const label of ["ลูกค้ามุ่งหวัง", "ยอดจอง", "Booking Delivery", "รอผลไฟแนนซ์", "รอส่งมอบ", "ส่งมอบแล้ว"]) assert.match(page, new RegExp(label));
});

test("scoped cache identities differ across session user, target user, and month", async () => {
  const source = await read("lib/dashboard-scope.ts");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${output}})(module.exports,module)`, { module, exports: module.exports, Intl, Date });
  const { dashboardCacheKey } = module.exports;
  const keys = new Set([
    dashboardCacheKey("A", "A", "2026-08"), dashboardCacheKey("B", "B", "2026-08"),
    dashboardCacheKey("A", "A", "2026-07"), dashboardCacheKey("ADMIN", "A", "2026-08"),
    dashboardCacheKey("ADMIN", "B", "2026-08")
  ]);
  assert.equal(keys.size, 5);
});

test("fixture: month boundaries, stable owners, QA exclusions and same-plate cases remain isolated", async () => {
  const { derivePersonalDashboardMetrics } = await loadMetricsModule();
  const user = (id, firstName) => ({ id, firstName, lastName: "Sales", nickname: firstName, email: `${id}@example.test`, locked: false });
  const report = (id, date, overrides = {}) => ({ id, type: "booking", bookingDate: date, createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`, status: "draft", plate: "SAME", saleName: "", reportText: "", ...overrides });
  const users = [user("A", "Alpha"), user("B", "Beta")];
  const reports = [
    report("BR-JUL", "2026-07-31"), report("BR-A1", "2026-08-01"), report("BR-A2", "2026-08-31"),
    report("BR-B", "2026-08-15"), report("BR-SEP", "2026-09-01"),
    report("SR-A", "2026-08-01", { type: "sales", bookingReportId: "BR-A1", deliveryDate: "2026-08-20", status: "delivered" }),
    report("BR-QA", "2026-08-12", { qaTestRecord: true, excludeFromMetrics: true, isCounted: false })
  ];
  const ownership = ["BR-JUL", "BR-A1", "BR-A2", "BR-SEP", "BR-QA"].map((caseId) => ({ caseType: "booking", caseId, ownerUserId: "A" })).concat([
    { caseType: "booking", caseId: "BR-B", ownerUserId: "B" }, { caseType: "sales", caseId: "SR-A", ownerUserId: "A" }
  ]);
  const bookingDeliveries = [
    { id: "BD-A", bookingReportId: "BR-A1", salesReportId: "SR-A", bookingDate: "2026-08-01", deliveredAt: "2026-08-20T10:00:00+07:00", ownerUserId: "A", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", createdAt: "2026-08-01" },
    { id: "BD-B", bookingReportId: "BR-B", salesReportId: "", bookingDate: "2026-08-15", ownerUserId: "B", status: "ยอดจอง", workflowStatus: "รอส่งมอบ", createdAt: "2026-08-15" },
    { id: "BD-QA", bookingReportId: "BR-QA", bookingDate: "2026-08-12", ownerUserId: "A", status: "ยอดจอง", workflowStatus: "รอส่งมอบ", qaTestRecord: true, excludeFromMetrics: true, isCounted: false, createdAt: "2026-08-12" }
  ];
  const common = { month: "2026-08", now: new Date("2026-08-25T03:00:00Z"), reports, prepRecords: [{ bookingId: "BR-A2" }, { bookingId: "BR-B" }], bookingDeliveries, ownership, users };
  const a = derivePersonalDashboardMetrics({ ...common, targetUserId: "A", leads: [{ ownerId: "A", date: "01/08/2026", createdAt: "2026-08-01" }, { ownerId: "B", date: "01/08/2026", createdAt: "2026-08-01" }] });
  const b = derivePersonalDashboardMetrics({ ...common, targetUserId: "B", leads: [] });
  assert.equal(a.bookings, 2);
  assert.equal(a.bookingDeliveries, 1);
  assert.equal(a.delivered, 1);
  assert.equal(a.waitingDelivery, 1);
  assert.equal(a.leads, 1);
  assert.equal(a.todayEvents, 0);
  assert.equal(b.bookings, 1);
  assert.equal(b.bookingDeliveries, 1);
  assert.equal(b.delivered, 0);
});

test("fixture: ambiguous exact legacy name is excluded instead of guessed", async () => {
  const { derivePersonalDashboardMetrics } = await loadMetricsModule();
  const users = [{ id: "A", firstName: "ชื่อซ้ำ", lastName: "คนขาย" }, { id: "B", firstName: "ชื่อซ้ำ", lastName: "คนขาย" }];
  const metrics = derivePersonalDashboardMetrics({ targetUserId: "A", month: "2026-08", now: new Date("2026-08-10T00:00:00Z"), leads: [], prepRecords: [], bookingDeliveries: [], ownership: [], users, reports: [{ id: "LEGACY", type: "booking", bookingDate: "2026-08-01", createdAt: "2026-08-01", status: "draft", saleName: "ชื่อซ้ำ คนขาย", reportText: "" }] });
  assert.equal(metrics.bookings, 0);
});
