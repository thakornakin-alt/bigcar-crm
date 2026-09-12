import { NextResponse } from "next/server";
import { listReportHistory } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

type ReportHistory = Awaited<ReturnType<typeof listReportHistory>>;
const inFlightReportHistory = new Map<string, Promise<ReportHistory>>();

async function listReportHistoryOncePerKey(query: string, type: string) {
  const key = `${query}\u0000${type}`;
  const existing = inFlightReportHistory.get(key);
  if (existing) {
    console.info("[report-history] join-in-flight", { query: Boolean(query), type });
    return existing;
  }

  const pending = listReportHistory(query, type);
  inFlightReportHistory.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inFlightReportHistory.get(key) === pending) inFlightReportHistory.delete(key);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const type = String(searchParams.get("type") || "all").trim();
    const reports = await listReportHistoryOncePerKey(query, type);
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { reports: [], error: error instanceof Error ? error.message : "Unable to load report history" },
      { status: 200 }
    );
  }
}
