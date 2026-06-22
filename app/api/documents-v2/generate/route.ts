import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { generateDocumentV2WithBytes } from "@/lib/documents-v2/generator";
import type { ReportHistoryItem } from "@/lib/types";
import { getTemplateById } from "@/lib/documents-v2/template-config";
import { readDocumentV2Mapping } from "@/lib/documents-v2/mapping-store";
import { resolveDocumentV2Data } from "@/lib/documents-v2/resolve-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isLocalDocumentTemplatePath(templatePath: string) {
  return /^\/document-templates\/[A-Za-z0-9._-]+\.(?:pdf|jpg|jpeg|png)$/i.test(templatePath);
}

async function loadTemplateBytes(templatePath: string, requestUrl: string) {
  if (isLocalDocumentTemplatePath(templatePath)) {
    const normalized = path.posix.normalize(templatePath);
    if (!normalized.startsWith("/document-templates/")) {
      throw new Error(`template path out of bounds: ${templatePath}`);
    }
    const relative = normalized.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), "public", relative);
    if (!filePath.toLowerCase().includes(`${path.sep}public${path.sep}document-templates${path.sep}`.toLowerCase())) {
      throw new Error(`template path out of bounds: ${templatePath}`);
    }
    try {
      return new Uint8Array(await readFile(filePath));
    } catch {
      throw new Error(`local template missing: ${templatePath}`);
    }
  }

  const origin = new URL(requestUrl).origin;
  const fileRes = await fetch(`${origin}${templatePath}`, { cache: "no-store" });
  if (!fileRes.ok) throw new Error(`ไม่พบไฟล์ template: ${templatePath}`);
  return new Uint8Array(await fileRes.arrayBuffer());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = (body.report || null) as ReportHistoryItem | null;
    const override = (body.data || {}) as Record<string, string>;
    const templateId = String(body.templateId || "").trim() || undefined;
    const template = getTemplateById(templateId);
    const templateBytes = await loadTemplateBytes(template.path, request.url);
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
