import { NextResponse } from "next/server";
import { runPowerOfAttorneyOcr } from "@/lib/documents-v2/power-of-attorney-ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const base64 = String(body.base64 || "").trim();
    const mimeType = String(body.mimeType || "").trim();
    const documentType = body.documentType === "company_certificate" ? "company_certificate" : "id_card";
    const result = await runPowerOfAttorneyOcr({ base64, mimeType, documentType });
    console.log("[api/documents-v2/power-of-attorney-ocr]", {
      provider: result.provider,
      documentType: result.documentType,
      status: result.provider === "free-ocr" ? "success" : "fallback"
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.log("[api/documents-v2/power-of-attorney-ocr]", {
      provider: "fallback",
      documentType: "id_card",
      status: "fallback"
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "OCR ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

