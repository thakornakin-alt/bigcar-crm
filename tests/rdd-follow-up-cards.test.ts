import test from "node:test";
import assert from "node:assert/strict";
import { deriveRddFollowUpCards, followUpCardPreviewItems, rddCaseHref } from "../lib/rdd-phase2.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

const base = {
  id: "CASE-BASE",
  plate: "1ขด 8124",
  purchaseType: "cash",
  caseStatus: "waiting_delivery",
  isCounted: true
} as BookingDeliveryRecord;

test("follow-up cards keep canonical urgent/high/normal sorting and nearest date", () => {
  const records: BookingDeliveryRecord[] = [
    { ...base, id: "normal", batteryStatus: "not_checked", deliveryDate: "2026-08-20" },
    { ...base, id: "tomorrow", batteryStatus: "not_checked", deliveryDate: "2026-08-14" },
    { ...base, id: "today", batteryStatus: "not_checked", deliveryDate: "2026-08-13" },
    { ...base, id: "overdue", batteryStatus: "not_checked", deliveryDate: "2026-08-12" }
  ];
  const cards = deriveRddFollowUpCards(records, "2026-08-13");
  assert.deepEqual(cards.map((card) => card.record.id), ["overdue", "today", "tomorrow", "normal"]);
  assert.deepEqual(cards.map((card) => card.priority), ["urgent", "urgent", "high", "normal"]);
  assert.equal(cards[0].items[0].label, "เลยกำหนดส่งมอบ");
  assert.equal(cards[1].items[0].label, "ส่งมอบวันนี้");
  assert.equal(cards[2].items[0].label, "ส่งมอบพรุ่งนี้");
});

test("garage overdue and preparation work use the existing reminder items", () => {
  const [card] = deriveRddFollowUpCards([{ ...base, garageRequired: true, garageExpectedReturnDate: "2026-08-12", batteryStatus: "not_checked", taxStatus: "not_checked" }], "2026-08-13");
  assert.equal(card.priority, "urgent");
  assert.deepEqual(card.items.map((item) => item.label), ["อู่ / รถกลับ", "แบตเตอรี่", "ภาษี"]);
  assert.equal(card.items.filter((item) => item.kind === "prep").length, 2);
});

test("paused, delivered, cancelled, QA, excluded and no-action cases stay off Home", () => {
  const records: BookingDeliveryRecord[] = [
    { ...base, id: "paused", caseStatus: "customer_paused", batteryStatus: "not_checked" },
    { ...base, id: "delivered", caseStatus: "delivered", batteryStatus: "not_checked" },
    { ...base, id: "cancelled", caseStatus: "cancelled", batteryStatus: "not_checked" },
    { ...base, id: "qa", qaTestRecord: true, batteryStatus: "not_checked" },
    { ...base, id: "excluded", excludeFromMetrics: true, batteryStatus: "not_checked" },
    { ...base, id: "done", batteryStatus: "good" }
  ];
  assert.deepEqual(deriveRddFollowUpCards(records, "2026-08-13"), []);
});

test("action cards expose Thai presentation data without raw workflow enums", () => {
  const [card] = deriveRddFollowUpCards([{ ...base, batteryStatus: "ordered_waiting" }], "2026-08-13");
  const serialized = JSON.stringify(card.items);
  assert.match(serialized, /แบตเตอรี่/);
  assert.match(serialized, /สั่งแล้ว \/ รอเปลี่ยน/);
  assert.doesNotMatch(serialized, /ordered_waiting|eligible_for_recognition|recognition_blocked/);
});

test("card preview caps visible work at two and navigation uses the stable case ID", () => {
  const [card] = deriveRddFollowUpCards([{ ...base, id: "CASE/100", batteryStatus: "not_checked", taxStatus: "not_checked", insuranceStatus: "not_discussed" }], "2026-08-13");
  const preview = followUpCardPreviewItems(card);
  assert.equal(preview.items.length, 2);
  assert.equal(preview.remaining, 1);
  assert.equal(rddCaseHref("CASE/100", "mine"), "/booking-delivery-workspace?caseId=CASE%2F100&scope=mine");
});
