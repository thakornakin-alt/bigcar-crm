import { listReportHistory } from "@/lib/apps-script";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const STORE_FILE = "report-history-complete-snapshot.json";
const MAX_SNAPSHOT_AGE_MS = 60_000;

type ReportHistory = Awaited<ReturnType<typeof listReportHistory>>;
type Snapshot = { reports: ReportHistory; capturedAt: string };
let inFlightAllReports: Promise<ReportHistory> | null = null;

function isRecent(snapshot: Snapshot | null) {
  if (!snapshot?.capturedAt || !Array.isArray(snapshot.reports)) return false;
  const age = Date.now() - Date.parse(snapshot.capturedAt);
  return Number.isFinite(age) && age >= 0 && age <= MAX_SNAPSHOT_AGE_MS;
}

async function readRecentSnapshot() {
  try {
    const snapshot = await readJsonStore<Snapshot | null>(STORE_FILE, null);
    return isRecent(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

async function persistSnapshot(reports: ReportHistory) {
  try {
    await writeJsonStore(STORE_FILE, { reports, capturedAt: new Date().toISOString() } satisfies Snapshot);
  } catch (error) {
    console.warn("report_history.snapshot.write_failed", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export async function listAllReportHistoryReliable(options: { preferRecentSnapshot?: boolean } = {}) {
  if (options.preferRecentSnapshot) {
    const snapshot = await readRecentSnapshot();
    if (snapshot) {
      console.info("report_history.complete_snapshot_hit", {
        capturedAt: snapshot.capturedAt,
        maxAgeMs: MAX_SNAPSHOT_AGE_MS
      });
      return snapshot.reports;
    }
  }

  if (inFlightAllReports) {
    console.info("[report-history] join-in-flight", { source: "all" });
    return inFlightAllReports;
  }

  const pending = (async () => {
    try {
      const reports = await listReportHistory("", "all");
      await persistSnapshot(reports);
      return reports;
    } catch (error) {
      const snapshot = await readRecentSnapshot();
      if (!snapshot) throw error;
      console.warn("report_history.complete_snapshot_fallback", {
        capturedAt: snapshot.capturedAt,
        maxAgeMs: MAX_SNAPSHOT_AGE_MS,
        reason: error instanceof Error ? error.message : "unknown"
      });
      return snapshot.reports;
    }
  })();

  inFlightAllReports = pending;
  try {
    return await pending;
  } finally {
    if (inFlightAllReports === pending) inFlightAllReports = null;
  }
}
