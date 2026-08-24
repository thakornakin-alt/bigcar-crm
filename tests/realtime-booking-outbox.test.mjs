import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile as readSource } from "node:fs/promises";
import test from "node:test";

const source = (path) => readSource(new URL(`../${path}`, import.meta.url), "utf8");

test("Realtime Booking active UI no longer acts as the notification worker", async () => {
  const page = await source("app/realtime-booking-v2/page.tsx");
  const autoSync = await source("app/api/realtime-booking-v2/auto-sync/route.ts");
  assert.doesNotMatch(page, /autoSendPendingRef|canAutoSendLine/);
  assert.match(autoSync, /enqueueAndProcessMatchedRealtimeBookingLines/);
});

test("legacy LINE sender is retired and active sender requires auth plus approved route", async () => {
  const legacy = await source("app/api/realtime-booking/send-line/route.ts");
  const active = await source("app/api/realtime-booking-v2/send-line/route.ts");
  const service = await source("lib/realtime-booking-outbox.ts");
  assert.match(legacy, /status: 410/);
  assert.match(active, /requireWritableUser/);
  assert.match(service, /listLineGroups/);
  assert.match(service, /INVALID_ROUTE/);
});

test("durable outbox is deterministic, locks processing, and never repeats sent events", async () => {
  const dir = await mkdtemp(join(tmpdir(), "crm-outbox-"));
  process.env.JSON_STORE_PROVIDER = "json";
  process.env.BIG_CAR_DATA_DIR = dir;
  const outbox = await import("../lib/notification-outbox.ts");
  try {
    const input = { eventType: "fixture", entityType: "booking", entityId: "BR-A", entityVersion: "1", ownerUserId: "USER-A", routeType: "line_group", routeId: "GROUP-A" };
    const first = await outbox.enqueueNotificationOutbox(input);
    const second = await outbox.enqueueNotificationOutbox(input);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.record.id, second.record.id);
    let sends = 0;
    const [one, two] = await Promise.all([
      outbox.processNotificationOutboxEvent(first.record.id, async () => { sends += 1; }),
      outbox.processNotificationOutboxEvent(first.record.id, async () => { sends += 1; })
    ]);
    assert.equal(sends, 1);
    assert.equal([one.record?.status, two.record?.status].includes("sent"), true);
    await outbox.processNotificationOutboxEvent(first.record.id, async () => { sends += 1; });
    assert.equal(sends, 1);
    const stored = JSON.parse(await readFile(join(dir, "notification-outbox.json"), "utf8"));
    assert.equal(stored.events[first.record.id].status, "sent");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("transient notification failures retry only delivery and terminal failures stop", async () => {
  const service = await source("lib/notification-outbox.ts");
  assert.match(service, /MAX_ATTEMPTS = 3/);
  assert.match(service, /\[5_000, 30_000, 120_000\]/);
  assert.match(service, /LINE_NETWORK_ERROR[^\n]+retryable: true/);
  assert.match(service, /LINE_TIMEOUT[^\n]+retryable: false/);
  assert.doesNotMatch(service, /saveBookingReport|saveSalesReport|createRealtimeBookingV2Queue/);
});
