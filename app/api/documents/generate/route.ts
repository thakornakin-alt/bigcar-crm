import { NextResponse } from "next/server";
import { generateFilledDocumentPdf } from "@/lib/documents/pdf-generator";
import { getDocumentTemplate } from "@/lib/documents/template-config";
import type { DocumentData, DocumentFieldConfig, DocumentTemplateId } from "@/lib/documents/document-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const templateId = String(body.templateId || "") as DocumentTemplateId;
    const data = (body.data || {}) as DocumentData;
    const fields = body.fields as Record<string, DocumentFieldConfig> | undefined;
    if (!templateId) return NextResponse.json({ error: "กรุณาเลือกประเภทเอกสาร" }, { status: 400 });

    const template = await getDocumentTemplate(templateId);
    if (!template) return NextResponse.json({ error: "ไม่พบ template" }, { status: 404 });

    const pdfBytes = await generateFilledDocumentPdf({ templateId, data, fields });
    const fileName = `${template.fileName.replace(/\.pdf$/i, "")}-${Date.now()}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ";
    const safeMessage =
      /ENOENT|\/var\/task|public\/document-templates/i.test(message)
        ? "ไม่พบไฟล์ PDF Template กรุณาอัปโหลด template ที่หน้า /documents/templates"
        : message;
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    );
  }
}
