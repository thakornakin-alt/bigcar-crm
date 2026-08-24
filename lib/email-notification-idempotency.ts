import { createHash } from "node:crypto";
import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";
import type { EmailDraftResult } from "@/lib/types";

type EventRecord = { key: string; fingerprint: string; status: "pending" | "sent" | "failed"; result?: EmailDraftResult; createdAt: string; updatedAt: string };
type Store = { version: 1; events: Record<string, EventRecord> };
const FILE = "email-notification-events.json";
const EMPTY: Store = { version: 1, events: {} };

export function notificationKey(eventType: string, entityId: string, recipient: string, version = "v1") {
  return createHash("sha256").update([eventType, entityId, recipient.toLowerCase(), version].join("|")).digest("hex");
}
export function notificationFingerprint(input: unknown) { return createHash("sha256").update(JSON.stringify(input)).digest("hex"); }

export async function reserveNotification(key: string, fingerprint: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
    const existing = snapshot.data.events[key];
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error("EMAIL_NOTIFICATION_IDEMPOTENCY_CONFLICT");
      return { created: false, record: existing };
    }
    const now = new Date().toISOString();
    const record: EventRecord = { key, fingerprint, status: "pending", createdAt: now, updatedAt: now };
    const next = { version: 1 as const, events: { ...snapshot.data.events, [key]: record } };
    const result = await compareAndSwapJsonStore(FILE, next, snapshot.revision);
    if (result.updated) return { created: true, record };
  }
  throw new Error("EMAIL_NOTIFICATION_RESERVATION_CONFLICT");
}

export async function finalizeNotification(key: string, status: "sent" | "failed", result?: EmailDraftResult) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
    const existing = snapshot.data.events[key];
    if (!existing) throw new Error("EMAIL_NOTIFICATION_RESERVATION_MISSING");
    const nextRecord = { ...existing, status, result, updatedAt: new Date().toISOString() };
    const next = { version: 1 as const, events: { ...snapshot.data.events, [key]: nextRecord } };
    const saved = await compareAndSwapJsonStore(FILE, next, snapshot.revision);
    if (saved.updated) return nextRecord;
  }
  throw new Error("EMAIL_NOTIFICATION_FINALIZE_CONFLICT");
}
