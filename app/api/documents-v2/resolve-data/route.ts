import { NextResponse } from "next/server";
import type { ReportHistoryItem } from "@/lib/types";
import { resolveDocumentV2Data } from "@/lib/documents-v2/resolve-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = (body.report || null) as ReportHistoryItem | null;
    const override = (body.data || {}) as Record<string, string>;
    const resolved = await resolveDocumentV2Data(report, override);
    return NextResponse.json({ ok: true, ...resolved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "โหลดข้อมูลเอกสาร V2 ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
