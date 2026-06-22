import { NextResponse } from "next/server";
import { generateDocumentV2WithBytes } from "@/lib/documents-v2/generator";
import type { ReportHistoryItem } from "@/lib/types";
import { getTemplateById } from "@/lib/documents-v2/template-config";
import { readDocumentV2Mapping } from "@/lib/documents-v2/mapping-store";
import { resolveDocumentV2Data } from "@/lib/documents-v2/resolve-data";
import { loadDocumentTemplateBytes } from "@/lib/documents-v2/template-bytes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = (body.report || null) as ReportHistoryItem | null;
    const override = (body.data || {}) as Record<string, string>;
    const templateId = String(body.templateId || "").trim() || undefined;
    const template = getTemplateById(templateId);
    const templateBytes = await loadDocumentTemplateBytes(template.path, request.url);
    const { data } = await resolveDocumentV2Data(report, override);
    const mapping = await readDocumentV2Mapping(template.id);
    const fieldProbeName = String(body.fieldProbeName || "").trim();
    const fieldProbeValue = String(body.fieldProbeValue || "").trim();
    if (fieldProbeName && fieldProbeValue) {
      Object.keys(mapping).forEach((key) => {
        mapping[key] = "";
      });
      mapping[fieldProbeName] = "customerName";
      data.customerName = fieldProbeValue;
    }
    const pdfBytes = await generateDocumentV2WithBytes(data, templateBytes, template.id, mapping, {
      hideFieldBorders: Boolean(template.hideFieldBorders)
    });
    const outputName = template.fileName;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${outputName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "สร้างเอกสาร V2 ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
