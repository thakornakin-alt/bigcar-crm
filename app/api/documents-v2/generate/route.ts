import { NextResponse } from "next/server";
import { generateDocumentV2WithBytes } from "@/lib/documents-v2/generator";
import { mapBookingToDocumentV2 } from "@/lib/documents-v2/types";
import type { ReportHistoryItem } from "@/lib/types";
import { getTemplateById } from "@/lib/documents-v2/template-config";
import { readDocumentV2Mapping } from "@/lib/documents-v2/mapping-store";
import { lookupStockByPlate } from "@/lib/apps-script";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizePlate(value: unknown) {
  return String(value || "").replace(/[\s\-_.]/g, "").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = (body.report || null) as ReportHistoryItem | null;
    const override = (body.data || {}) as Record<string, string>;
    const templateId = String(body.templateId || "").trim() || undefined;
    const template = getTemplateById(templateId);
    const origin = new URL(request.url).origin;
    const fileRes = await fetch(`${origin}${template.path}`, { cache: "no-store" });
    if (!fileRes.ok) throw new Error("ไม่พบไฟล์ template");
    const templateBytes = new Uint8Array(await fileRes.arrayBuffer());
    const rawReport = ((report || {}) as Record<string, unknown>);
    const plateFromReport = String(rawReport.plate || rawReport.licensePlate || "").trim();
    const normalizedReportPlate = normalizePlate(plateFromReport);
    const stock = plateFromReport ? await lookupStockByPlate(plateFromReport) : null;
    const stockRaw = (stock || {}) as Record<string, unknown>;
    const stockPlateRaw = String(stockRaw.plate || "");
    const isSamePlate = normalizedReportPlate && normalizePlate(stockPlateRaw) === normalizedReportPlate;

    const data = {
      ...Object.fromEntries(Object.entries(rawReport).map(([k, v]) => [k, v == null ? "" : String(v)])),
      ...Object.fromEntries(Object.entries(stockRaw).map(([k, v]) => [k, v == null ? "" : String(v)])),
      ...mapBookingToDocumentV2(report),
      plateNo: String(rawReport.plate || rawReport.licensePlate || stockRaw.plate || "").trim(),
      customerAddress: String(rawReport.address || rawReport.customerAddress || (isSamePlate ? (stockRaw.customerAddress || stockRaw.address) : "") || "").trim(),
      engineNo: String(
        rawReport.engineNo ||
        rawReport.engineNumber ||
        rawReport["เลขเครื่อง"] ||
        (isSamePlate ? (stockRaw.engineNo || stockRaw.engineNumber || stockRaw["เลขเครื่อง"] || stockRaw["เลขเครื่องยนต์"]) : "") ||
        ""
      ).trim(),
      chassisNo: String(
        rawReport.chassisNo ||
        rawReport.chassisNumber ||
        rawReport.vin ||
        rawReport["เลขตัวถัง"] ||
        (isSamePlate ? (stockRaw.vin || stockRaw.chassisNo || stockRaw.chassisNumber || stockRaw["เลขตัวถัง"] || stockRaw["เลขตัวรถ"]) : "") ||
        ""
      ).trim(),
      ...override
    };
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
    const pdfBytes = await generateDocumentV2WithBytes(data, templateBytes, mapping);
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
