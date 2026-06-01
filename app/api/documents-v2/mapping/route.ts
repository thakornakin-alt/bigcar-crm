import { NextResponse } from "next/server";
import { readDocumentV2Mapping, writeDocumentV2Mapping, type DocumentV2FieldMapping } from "@/lib/documents-v2/mapping-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const mapping = await readDocumentV2Mapping();
    return NextResponse.json({ ok: true, mapping });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "โหลด mapping ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mapping = (body?.mapping || {}) as DocumentV2FieldMapping;
    const saved = await writeDocumentV2Mapping(mapping);
    return NextResponse.json({ ok: true, mapping: saved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "บันทึก mapping ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

