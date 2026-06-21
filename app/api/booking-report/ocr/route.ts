import { NextResponse } from "next/server";
import { runBookingReportOcr } from "@/lib/booking-report-ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runBookingReportOcr({
      base64: body.base64,
      mimeType: body.mimeType,
      documentType: body.documentType
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR อ่านเอกสารไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
