import { createHash, randomUUID } from "node:crypto";
import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";

export type NotificationOutboxStatus = "pending" | "processing" | "sent" | "retryable_failure" | "terminal_failure";
export type NotificationErrorCode = "timeout" | "network_error" | "unauthorized" | "forbidden" | "invalid_route" | "provider_error" | "rate_limited" | "idempotency_conflict" | "configuration_error" | "unknown_error";

export type NotificationOutboxRecord = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityVersion: string;
  ownerUserId: string;
  routeType: "line_group";
  routeId: string;
  status: NotificationOutboxStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string;
  sentAt?: string;
  failedAt?: string;
  lastErrorCode?: NotificationErrorCode;
  idempotencyKey: string;
  processingOwner?: string;
  processingExpiresAt?: string;
};

type OutboxStore = { version: 1; events: Record<string, NotificationOutboxRecord> };
const FILE = "notification-outbox.json";
const EMPTY: OutboxStore = { version: 1, events: {} };
const MAX_ATTEMPTS = 3;
const PROCESSING_LEASE_MS = 30_000;
let localOutboxLock: Promise<void> = Promise.resolve();

async function withLocalOutboxLock<T>(work: () => Promise<T>) {
  const previous = localOutboxLock;
  let release = () => {};
  localOutboxLock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await work(); } finally { release(); }
}

export function notificationOutboxKey(input: Pick<NotificationOutboxRecord, "eventType" | "entityId" | "entityVersion" | "routeType" | "routeId">) {
  return createHash("sha256").update([input.eventType, input.entityId, input.entityVersion, input.routeType, input.routeId].join("|")).digest("hex");
}

async function mutateEvent(id: string, mutate: (record: NotificationOutboxRecord) => NotificationOutboxRecord | null) {
  return withLocalOutboxLock(async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
      const current = snapshot.data.events[id];
      if (!current) return null;
      const nextRecord = mutate(current);
      if (!nextRecord) return null;
      const next: OutboxStore = { version: 1, events: { ...snapshot.data.events, [id]: nextRecord } };
      const saved = await compareAndSwapJsonStore(FILE, next, snapshot.revision);
      if (saved.updated) return nextRecord;
    }
    throw new Error("NOTIFICATION_OUTBOX_CAS_CONFLICT");
  });
}

export async function enqueueNotificationOutbox(input: {
  eventType: string; entityType: string; entityId: string; entityVersion: string; ownerUserId: string; routeType: "line_group"; routeId: string;
}) {
  return withLocalOutboxLock(async () => {
    const idempotencyKey = notificationOutboxKey(input);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
      const existing = snapshot.data.events[idempotencyKey];
      if (existing) return { created: false, record: existing };
      const now = new Date().toISOString();
      const record: NotificationOutboxRecord = {
        id: idempotencyKey, ...input, status: "pending", attempts: 0, createdAt: now, updatedAt: now, nextAttemptAt: now, idempotencyKey
      };
      const next: OutboxStore = { version: 1, events: { ...snapshot.data.events, [idempotencyKey]: record } };
      const saved = await compareAndSwapJsonStore(FILE, next, snapshot.revision);
      if (saved.updated) return { created: true, record };
    }
    throw new Error("NOTIFICATION_OUTBOX_IDEMPOTENCY_CONFLICT");
  });
}

function retryDelayMs(attempts: number) { return [5_000, 30_000, 120_000][Math.max(0, attempts - 1)] || 120_000; }

export function classifyNotificationError(error: unknown): { code: NotificationErrorCode; retryable: boolean } {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("LINE_TIMEOUT")) return { code: "timeout", retryable: false };
  if (message.includes("LINE_NETWORK_ERROR")) return { code: "network_error", retryable: true };
  if (message.includes("HTTP_429")) return { code: "rate_limited", retryable: true };
  if (/HTTP_5\d\d/.test(message)) return { code: "provider_error", retryable: true };
  if (message.includes("unauthorized")) return { code: "unauthorized", retryable: false };
  if (message.includes("forbidden")) return { code: "forbidden", retryable: false };
  if (message.includes("INVALID_ROUTE")) return { code: "invalid_route", retryable: false };
  if (message.includes("configuration")) return { code: "configuration_error", retryable: false };
  return { code: "provider_error", retryable: false };
}

export async function processNotificationOutboxEvent(
  id: string,
  deliver: (record: NotificationOutboxRecord) => Promise<void>,
  now = new Date()
) {
  const owner = randomUUID();
  const claimed = await mutateEvent(id, (current) => {
    if (current.status === "sent" || current.status === "terminal_failure") return null;
    if (Date.parse(current.nextAttemptAt) > now.getTime()) return null;
    if (current.status === "processing" && Date.parse(current.processingExpiresAt || "") > now.getTime()) return null;
    if (current.attempts >= MAX_ATTEMPTS) return { ...current, status: "terminal_failure", failedAt: now.toISOString(), updatedAt: now.toISOString() };
    return { ...current, status: "processing", attempts: current.attempts + 1, processingOwner: owner, processingExpiresAt: new Date(now.getTime() + PROCESSING_LEASE_MS).toISOString(), updatedAt: now.toISOString() };
  });
  if (!claimed || claimed.status !== "processing" || claimed.processingOwner !== owner) return { processed: false, record: claimed };

  const startedAt = Date.now();
  try {
    await deliver(claimed);
    const sent = await mutateEvent(id, (current) => current.processingOwner === owner ? {
      ...current, status: "sent", sentAt: new Date().toISOString(), updatedAt: new Date().toISOString(), processingOwner: undefined, processingExpiresAt: undefined, lastErrorCode: undefined
    } : null);
    console.info(JSON.stringify({ event: "notification_outbox", eventId: id, entityId: claimed.entityId, routeType: claimed.routeType, status: "sent", attempts: claimed.attempts, durationMs: Date.now() - startedAt }));
    return { processed: true, record: sent };
  } catch (error) {
    const failure = classifyNotificationError(error);
    const retryable = failure.retryable && claimed.attempts < MAX_ATTEMPTS;
    const failed = await mutateEvent(id, (current) => current.processingOwner === owner ? {
      ...current, status: retryable ? "retryable_failure" : "terminal_failure", nextAttemptAt: retryable ? new Date(Date.now() + retryDelayMs(current.attempts)).toISOString() : current.nextAttemptAt,
      failedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), processingOwner: undefined, processingExpiresAt: undefined, lastErrorCode: failure.code
    } : null);
    console.error(JSON.stringify({ event: "notification_outbox", eventId: id, entityId: claimed.entityId, routeType: claimed.routeType, status: failed?.status || "unknown_error", attempts: claimed.attempts, durationMs: Date.now() - startedAt, errorCode: failure.code }));
    return { processed: true, record: failed };
  }
}

export async function listDueNotificationOutbox(eventType: string, now = new Date()) {
  const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
  return Object.values(snapshot.data.events).filter((event) => event.eventType === eventType && ["pending", "retryable_failure"].includes(event.status) && Date.parse(event.nextAttemptAt) <= now.getTime());
}

export const notificationOutboxPolicy = { file: FILE, maxAttempts: MAX_ATTEMPTS, processingLeaseMs: PROCESSING_LEASE_MS };
