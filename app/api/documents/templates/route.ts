import { NextResponse } from "next/server";
import { listDocumentTemplatesWithOverrides, saveDocumentTemplateFields, saveDocumentTemplatePdf } from "@/lib/documents/template-config";
import type { DocumentFieldConfig, DocumentTemplateId } from "@/lib/documents/document-types";
import { PDFDocument } from "pdf-lib";

export const dynamic = "force-dynamic";
const primaryTemplateIds = new Set(["contract", "temporary-receipt"]);

export async function GET() {
  try {
    const templates = await listDocumentTemplatesWithOverrides();
    return NextResponse.json({ templates: templates.filter((template) => primaryTemplateIds.has(template.id)) });
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const templateId = String(body.templateId || "") as DocumentTemplateId;
    const fileName = String(body.fileName || "template.pdf");
    const mimeType = String(body.mimeType || "");
    const base64 = String(body.base64 || "");
    if (!templateId) return NextResponse.json({ error: "กรุณาเลือก template" }, { status: 400 });
    if (!primaryTemplateIds.has(templateId)) return NextResponse.json({ error: "รองรับเฉพาะ Template หลักเท่านั้น" }, { status: 400 });
    if (mimeType && mimeType !== "application/pdf") return NextResponse.json({ error: "รองรับเฉพาะไฟล์ PDF" }, { status: 400 });
    if (!base64) return NextResponse.json({ error: "ไม่พบข้อมูลไฟล์ PDF" }, { status: 400 });

    // Validate AcroForm before saving override to avoid replacing a valid template with flattened PDF.
    const bytes = Buffer.from(base64, "base64");
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const fieldCount = form.getFields().length;
    if (fieldCount === 0) {
      return NextResponse.json(
        { error: "ไฟล์นี้ไม่มีช่องกรอก (AcroForm) กรุณาใช้ไฟล์ PDF ที่ยังมีฟิลด์จริง" },
        { status: 400 }
      );
    }

    const template = await saveDocumentTemplatePdf({ templateId, fileName, mimeType, base64 });
    return NextResponse.json({ template, fieldCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปโหลด PDF template ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
