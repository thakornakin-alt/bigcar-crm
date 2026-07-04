import { NextResponse } from "next/server";
import { runVehicleDeliveryOcr } from "@/lib/documents-v2/vehicle-delivery-ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const base64 = String(body.base64 || "").trim();
    const mimeType = String(body.mimeType || "").trim();
    const result = await runVehicleDeliveryOcr({ base64, mimeType });
    console.log("[api/documents-v2/vehicle-delivery-ocr]", {
      provider: result.provider,
      status: result.provider === "free-ocr" ? "success" : "fallback"
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.log("[api/documents-v2/vehicle-delivery-ocr]", {
      provider: "fallback",
      status: "fallback"
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "OCR ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
