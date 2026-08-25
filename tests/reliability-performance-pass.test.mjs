import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Apps Script has bounded timeout, read-only retry, and safe trace metadata", async () => {
  const source = await read("lib/apps-script.ts");
  assert.match(source, /timeoutMs = 15000/);
  assert.match(source, /RETRYABLE_READ_ACTIONS/);
  assert.match(source, /maxAttempts = RETRYABLE_READ_ACTIONS\.has\(action\) \? 2 : 1/);
  assert.match(source, /event: "apps_script_request"/);
  assert.doesNotMatch(source, /password.*console|signature.*console|payload.*console/i);
});

test("business writes are never included in automatic retry allowlist", async () => {
  const source = await read("lib/apps-script.ts");
  const retryBlock = source.slice(source.indexOf("const RETRYABLE_READ_ACTIONS"), source.indexOf("const SIGNED_APPS_SCRIPT_ACTIONS"));
  for (const action of ["saveBookingReport", "saveSalesReport", "add", "update", "delete", "createBookingEmailDraft", "sendPasswordResetEmail"]) {
    assert.doesNotMatch(retryBlock, new RegExp(`"${action}"`));
  }
});

test("Dashboard parallelizes independent sources and never associates Sales by plate", async () => {
  const source = await read("app/api/dashboard/metrics/route.ts");
  const metrics = await read("lib/dashboard-personal-metrics.ts");
  assert.match(source, /Promise\.allSettled/);
  assert.match(metrics, /salesBookingIds\.has\(report\.id\)/);
  assert.doesNotMatch(metrics, /salesPlateKeys/);
  assert.match(source, /const complete = failures\.length === 0/);
});

test("Dashboard and RDD preserve last-known-good on transient read failure", async () => {
  const dashboard = await read("app/dashboard/page.tsx");
  const hook = await read("components/rdd/use-booking-delivery-read.ts");
  const rdd = await read("components/rdd/rdd-home-client.tsx");
  assert.match(dashboard, /bigcar-dashboard-last-good/);
  assert.match(dashboard, /ข้อมูลอาจไม่ใช่ล่าสุด/);
  assert.doesNotMatch(hook, /catch \(loadError\) \{\s*setRecords\(\[\]\)/);
  assert.match(rdd, /error && records\.length === 0/);
});

test("LINE has bounded read/write timeout and validates approved target", async () => {
  const line = await read("lib/line.ts");
  const send = await read("app/api/line/test-send/route.ts");
  assert.match(line, /LINE_READ_TIMEOUT_MS = 6000/);
  assert.match(line, /LINE_WRITE_TIMEOUT_MS = 10000/);
  assert.match(send, /listLineGroups/);
  assert.match(send, /group\.groupId === groupId/);
  assert.match(send, /requireWritableUser/);
});

test("Sales email remains disabled and Booking draft remains separate from Booking create", async () => {
  const sales = await read("app/api/email/sales-draft/route.ts");
  const bookingDraft = await read("app/api/email/booking-draft/route.ts");
  assert.match(sales, /sales_report_email_disabled/);
  assert.doesNotMatch(bookingDraft, /saveBookingReport/);
  assert.match(bookingDraft, /reserveNotification/);
});

test("active Google, Gmail, and OCR integrations have bounded external requests", async () => {
  for (const path of [
    "lib/booking-report-ocr.ts",
    "lib/ocr-document.ts",
    "lib/realtime-gmail.ts",
    "lib/realtime-booking-v2.ts",
    "app/api/stock/staging/gmail-sync/route.ts",
    "app/api/realtime-booking/gmail-oauth/callback/route.ts",
    "app/api/drive/line-image/[fileId]/route.ts"
  ]) {
    const source = await read(path);
    const externalFetches = [...source.matchAll(/fetch\((?:`|\"|')https:\/\//g)].length;
    const boundedSignals = [...source.matchAll(/signal: AbortSignal\.timeout\(/g)].length;
    assert.ok(boundedSignals >= externalFetches, `${path} has an unbounded external fetch`);
  }
});
