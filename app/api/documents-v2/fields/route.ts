import { NextResponse } from "next/server";
import { listTemplateFieldsV2 } from "@/lib/documents-v2/generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listTemplateFieldsV2();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "โหลด fields ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

