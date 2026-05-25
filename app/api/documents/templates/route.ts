import { NextResponse } from "next/server";
import { listDocumentTemplatesWithOverrides, saveDocumentTemplateFields } from "@/lib/documents/template-config";
import type { DocumentFieldConfig, DocumentTemplateId } from "@/lib/documents/document-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await listDocumentTemplatesWithOverrides();
    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลด template ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const templateId = String(body.templateId || "") as DocumentTemplateId;
    const fields = (body.fields || {}) as Record<string, DocumentFieldConfig>;
    if (!templateId) return NextResponse.json({ error: "กรุณาเลือก template" }, { status: 400 });
    const template = await saveDocumentTemplateFields(templateId, fields);
    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึก config ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
