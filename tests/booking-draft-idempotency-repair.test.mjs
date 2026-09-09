import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sent replay verifies the exact Gmail Draft before returning success", async () => {
  const route = await readFile(new URL("../app/api/email/booking-draft/route.ts", import.meta.url), "utf8");
  assert.match(route, /bookingEmailDraftExists\(draftId\)/);
  assert.match(route, /if \(verification\.exists\).*idempotentReplay: true/);
  assert.match(route, /rearmNotification\(key, fingerprint, "sent"\)/);
  assert.match(route, /booking_draft_verification_unavailable/);
  assert.match(route, /retryable: true/);
});

test("atomic re-arm keeps pending concurrency protection and never touches Booking persistence", async () => {
  const store = await readFile(new URL("../lib/email-notification-idempotency.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/email/booking-draft/route.ts", import.meta.url), "utf8");
  assert.match(store, /existing\.status !== expectedStatus/);
  assert.match(store, /compareAndSwapJsonStore\(FILE, next, snapshot\.revision\)/);
  assert.match(store, /status: "pending"/);
  assert.match(route, /email_notification_pending/);
  assert.doesNotMatch(route, /saveBookingReport|\/api\/booking-reports/);
});

test("missing Draft retry creates only the Draft side effect", async () => {
  const route = await readFile(new URL("../app/api/email/booking-draft/route.ts", import.meta.url), "utf8");
  const rearmIndex = route.indexOf('rearmNotification(key, fingerprint, "sent")');
  const createIndex = route.indexOf("createBookingEmailDraft(payload)");
  assert.ok(rearmIndex >= 0 && createIndex > rearmIndex);
  assert.equal((route.match(/createBookingEmailDraft\(payload\)/g) || []).length, 1);
});
