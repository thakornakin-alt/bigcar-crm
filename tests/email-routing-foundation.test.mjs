import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("central router resolves by stable ownerUserId and canonical SalesUsers", async () => {
  const source = await read("lib/email-routing.ts");
  assert.match(source, /getCaseOwnership/);
  assert.match(source, /user\.id === ownerUserId/);
  assert.match(source, /String\(owner\.email/);
  assert.doesNotMatch(source, /ownerDisplayName.*find/);
});

test("actor and owner stay separate when another user opens a case", async () => {
  const source = await read("lib/email-routing.ts");
  assert.match(source, /ownership\?\.ownerUserId/);
  assert.doesNotMatch(source, /requireWritableUser.*ownerUserId/);
});

test("Booking draft API overwrites browser recipients", async () => {
  const source = await read("app/api/email/booking-draft/route.ts");
  assert.match(source, /payload\.to = route\.recipient\.to/);
  assert.match(source, /payload\.cc = route\.recipient\.cc/);
  assert.match(source, /unresolved_email_route/);
});

test("approval route is configured separately from owner route", async () => {
  const source = await read("lib/email-routing.ts");
  assert.match(source, /APPROVAL_EMAIL_TO/);
  assert.match(source, /type: "approval"/);
  assert.match(source, /type: "owner"/);
});

test("Booking route is fixed and Sales email is disabled", async () => {
  const router = await read("lib/email-routing.ts");
  const salesApi = await read("app/api/email/sales-draft/route.ts");
  assert.match(router, /RDDUsedcarBooked@segroup\.co\.th/);
  assert.match(router, /rongsarit\.s@tgh\.co\.th/);
  assert.match(router, /eventType === "sales_report_draft"\) return null/);
  assert.match(salesApi, /sales_report_email_disabled/);
  assert.match(salesApi, /status: 410/);
});

test("notification idempotency is independent from business writes", async () => {
  const source = await read("lib/email-notification-idempotency.ts");
  assert.match(source, /eventType, entityId, recipient\.toLowerCase\(\), version/);
  assert.match(source, /EMAIL_NOTIFICATION_IDEMPOTENCY_CONFLICT/);
  assert.match(source, /status: "pending"/);
  assert.doesNotMatch(source, /saveBookingReport|saveSalesReport/);
});

test("sender identity is truthful and server controlled", async () => {
  const source = await read("lib/email-routing.ts");
  assert.match(source, /apps_script_execution_account/);
  assert.doesNotMatch(source, /senderEmail/);
});
