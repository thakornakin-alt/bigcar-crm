import { listSalesUsers } from "@/lib/apps-script";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { SalesUser } from "@/lib/types";

const STORE_FILE = "sales-users-authoritative-snapshot.json";
const MAX_FALLBACK_AGE_MS = 60_000;

type Snapshot = { users: SalesUser[]; capturedAt: string };
let inFlight: Promise<SalesUser[]> | null = null;

function isRecent(snapshot: Snapshot | null) {
  if (!snapshot?.capturedAt || !Array.isArray(snapshot.users)) return false;
  const age = Date.now() - Date.parse(snapshot.capturedAt);
  return Number.isFinite(age) && age >= 0 && age <= MAX_FALLBACK_AGE_MS;
}

async function readRecentSnapshot() {
  try {
    const snapshot = await readJsonStore<Snapshot | null>(STORE_FILE, null);
    return isRecent(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

async function persistSnapshot(users: SalesUser[]) {
  try {
    await writeJsonStore(STORE_FILE, { users, capturedAt: new Date().toISOString() } satisfies Snapshot);
  } catch (error) {
    console.warn("sales_users.snapshot.write_failed", { reason: error instanceof Error ? error.message : "unknown" });
  }
}

export async function listSalesUsersReliable(options: { preferRecentSnapshot?: boolean } = {}) {
  if (options.preferRecentSnapshot) {
    const snapshot = await readRecentSnapshot();
    if (snapshot) {
      console.info("sales_users.authoritative_snapshot_hit", { capturedAt: snapshot.capturedAt, maxAgeMs: MAX_FALLBACK_AGE_MS });
      return snapshot.users;
    }
  }
  if (inFlight) {
    console.info("[sales-users] join-in-flight");
    return inFlight;
  }
  const pending = (async () => {
    try {
      const users = await listSalesUsers();
      await persistSnapshot(users);
      return users;
    } catch (error) {
      const snapshot = await readRecentSnapshot();
      if (!snapshot) throw error;
      console.warn("sales_users.authoritative_fallback", {
        capturedAt: snapshot.capturedAt,
        maxAgeMs: MAX_FALLBACK_AGE_MS,
        reason: error instanceof Error ? error.message : "unknown"
      });
      return snapshot.users;
    }
  })();
  inFlight = pending;
  try {
    return await pending;
  } finally {
    if (inFlight === pending) inFlight = null;
  }
}
