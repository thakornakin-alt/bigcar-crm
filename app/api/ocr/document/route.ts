import { NextResponse } from "next/server";
import { readDocumentOcr } from "@/lib/ocr-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await readDocumentOcr(await request.json());
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR อ่านเอกสารไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
