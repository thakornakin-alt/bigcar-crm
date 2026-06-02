import { NextResponse } from "next/server";
import { generateDocumentV2WithBytes } from "@/lib/documents-v2/generator";
import { mapBookingToDocumentV2 } from "@/lib/documents-v2/types";
import type { ReportHistoryItem } from "@/lib/types";
import { getTemplateById } from "@/lib/documents-v2/template-config";
import { readDocumentV2Mapping } from "@/lib/documents-v2/mapping-store";
import { listStockVehicles, lookupStockByPlate } from "@/lib/apps-script";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizePlate(value: unknown) {
  return String(value || "").replace(/[\s\-_.]/g, "").trim();
}

function extractFromReportText(text: string, patterns: RegExp[]) {
  const source = String(text || "");
  for (const pattern of patterns) {
    const matched = source.match(pattern);
    if (matched?.[1]) return String(matched[1]).trim();
  }
  return "";
}

function objectValue(source: Record<string, unknown>, keys: string[]) {
  const extra = source.extraFields && typeof source.extraFields === "object" ? source.extraFields as Record<string, unknown> : {};
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/[()/_\-.]/g, "");
  for (const key of keys) {
    const value = source[key] ?? extra[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  const extraEntries = Object.entries(extra);
  for (const key of keys) {
    const normalizedKey = normalize(key);
    const matched = extraEntries.find(([extraKey]) => normalize(String(extraKey || "")) === normalizedKey);
    if (matched && matched[1] !== undefined && matched[1] !== null && String(matched[1]).trim()) {
      return String(matched[1]).trim();
    }
  }
  return "";
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
    const reportText = String(rawReport.reportText || "");
    const plateFromReport = String(rawReport.plate || rawReport.licensePlate || "").trim();
    const normalizedReportPlate = normalizePlate(plateFromReport);
    let stock = plateFromReport ? await lookupStockByPlate(plateFromReport) : null;
    if (stock) {
      const [mergedStock] = await mergeStockExtraFields([stock]);
      stock = mergedStock || stock;
    }
    if (!stock && plateFromReport) {
      const shortQuery = plateFromReport.replace(/\s+/g, "").slice(0, 4);
      if (shortQuery) {
        const listed = await listStockVehicles({ query: shortQuery, limit: 50 });
        const mergedListed = await mergeStockExtraFields(listed.vehicles || []);
        const match = mergedListed.find((v) => normalizePlate(v.plate) === normalizePlate(plateFromReport));
        stock = match || null;
      }
    }
    const stockRaw = (stock || {}) as Record<string, unknown>;
    const stockPlateRaw = String(stockRaw.plate || "");
    const isSamePlate = normalizedReportPlate && normalizePlate(stockPlateRaw) === normalizedReportPlate;

    const engineFromReportText = extractFromReportText(reportText, [
      /เลขเครื่อง(?:ยนต์)?\s*[:：]\s*([^\r\n]+)/i
    ]);
    const chassisFromReportText = extractFromReportText(reportText, [
      /เลขตัวถัง\s*[:：]\s*([^\r\n]+)/i,
      /VIN\s*[:：]\s*([^\r\n]+)/i
    ]);

    const data = {
      ...Object.fromEntries(Object.entries(rawReport).map(([k, v]) => [k, v == null ? "" : String(v)])),
      ...Object.fromEntries(Object.entries(stockRaw).map(([k, v]) => [k, v == null ? "" : String(v)])),
      ...mapBookingToDocumentV2(report),
      plateNo: String(rawReport.plate || rawReport.licensePlate || stockRaw.plate || "").trim(),
      customerAddress: String(
        objectValue(rawReport, ["address", "customerAddress", "shippingAddress", "ที่อยู่", "ที่อยู่จัดส่งเอกสาร"]) ||
        (isSamePlate ? objectValue(stockRaw, ["customerAddress", "address", "shippingAddress", "ที่อยู่", "ที่อยู่จัดส่งเอกสาร"]) : "") ||
        ""
      ).trim(),
      engineNo: String(
        objectValue(rawReport, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]) ||
        engineFromReportText ||
        (isSamePlate ? objectValue(stockRaw, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]) : "") ||
        ""
      ).trim(),
      chassisNo: String(
        objectValue(rawReport, ["chassisNo", "chassisNumber", "vin", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]) ||
        chassisFromReportText ||
        (isSamePlate ? objectValue(stockRaw, ["vin", "chassisNo", "chassisNumber", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]) : "") ||
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
