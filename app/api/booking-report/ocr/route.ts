import { NextResponse } from "next/server";
import { runBookingReportOcr } from "@/lib/booking-report-ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let documentType = "unknown";
  try {
    const body = await request.json();
    documentType = String(body.documentType || "unknown");
    const result = await runBookingReportOcr({
      base64: body.base64,
      mimeType: body.mimeType,
      documentType: body.documentType
    });
    console.log("[api/booking-report/ocr]", {
      provider: result.provider,
      documentType: result.documentType,
      status: result.provider === "openai" ? "success" : "fallback"
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.log("[api/booking-report/ocr]", {
      provider: "fallback",
      documentType,
      status: "error"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR อ่านเอกสารไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
