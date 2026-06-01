import { NextResponse } from "next/server";
import { generateDocumentV2 } from "@/lib/documents-v2/generator";
import { mapBookingToDocumentV2 } from "@/lib/documents-v2/types";
import type { ReportHistoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = (body.report || null) as ReportHistoryItem | null;
    const override = (body.data || {}) as Record<string, string>;
    const data = { ...mapBookingToDocumentV2(report), ...override };
    const pdfBytes = await generateDocumentV2(data);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="temporary-receipt-v2.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "สร้างเอกสาร V2 ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

