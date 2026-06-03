"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Loader2, Search } from "lucide-react";
import { PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { DocumentTemplateConfig, DocumentTemplateId } from "@/lib/documents/document-types";
import { documentFileToOcrPayloads, mergeOcrRecords } from "@/lib/ocr/client-document-ocr";

type ReportRecord = Record<string, unknown> & {
  id?: string;
  type?: string;
  customerName?: string;
  phone?: string;
  plate?: string;
  brand?: string;
  model?: string;
  year?: string;
  color?: string;
  saleName?: string;
  createdAt?: string;
  status?: string;
};

type VehicleRecord = Record<string, unknown> & {
  plate?: string;
  brand?: string;
  model?: string;
  year?: string;
  color?: string;
  mileage?: string;
  salePrice?: string;
  pdiNote?: string;
  pdiStatus?: string;
};

type DocumentData = Record<string, string>;

const draftKey = "bigcar-document-drafts-v1";
const autoTemplateIds: DocumentTemplateId[] = ["contract", "temporary-receipt"];

const emptyDocumentData: DocumentData = {
  customerName: "",
  idCard: "",
  phone: "",
  address: "",
  customerAddress: "",
  plateNumber: "",
  plate: "",
  carBrand: "",
  carModel: "",
  year: "",
  color: "",
  mileage: "",
  price: "",
  salePrice: "",
  bookingPrice: "",
  bookingNo: "",
  discountPrice: "",
  netCarPrice: "",
  paymentType: "",
  deliveryDate: "",
  deliveryLocation: "",
  saleName: "",
  sellerName: "",
  signatureName: "",
  bookingDate: "",
  status: "",
  pdiStatus: "",
  pdiNote: "",
  vin: "",
  engineNumber: "",
  engineNo: "",
  financeName: ""
};

const editableFields: Array<{ key: string; label: string; optional?: boolean }> = [
  { key: "customerName", label: "ชื่อลูกค้า" },
  { key: "idCard", label: "เลขบัตร / เลขผู้เสียภาษี" },
  { key: "phone", label: "เบอร์โทร", optional: true },
  { key: "address", label: "ที่อยู่", optional: true },
  { key: "plate", label: "ทะเบียน" },
  { key: "carBrand", label: "ยี่ห้อรถ" },
  { key: "carModel", label: "รุ่นรถยนต์" },
  { key: "year", label: "ปีจด" },
  { key: "color", label: "สี" },
  { key: "mileage", label: "เลขไมล์" },
  { key: "salePrice", label: "ราคาเสนอขายRT" },
  { key: "bookingPrice", label: "เงินจอง", optional: true },
  { key: "bookingNo", label: "เลขที่ใบจอง", optional: true },
  { key: "discountPrice", label: "ส่วนลด", optional: true },
  { key: "netCarPrice", label: "ราคาสุทธิ", optional: true },
  { key: "paymentType", label: "ประเภทการชำระ", optional: true },
  { key: "deliveryDate", label: "วันที่ส่งมอบ", optional: true },
  { key: "deliveryLocation", label: "สถานที่ส่งมอบ", optional: true },
  { key: "sellerName", label: "ชื่อผู้ขาย" },
  { key: "bookingDate", label: "วันที่จอง/ขาย" },
  { key: "status", label: "สถานะ" },
  { key: "pdiStatus", label: "สถานะปรับสภาพ PDI" },
  { key: "pdiNote", label: "หมายเหตุ PDI" },
  { key: "vin", label: "เลขตัวถัง", optional: true },
  { key: "engineNo", label: "เลขเครื่อง", optional: true },
  { key: "financeName", label: "ไฟแนนซ์", optional: true }
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  if (!response.ok) throw new Error("Request failed");
  return (await response.blob()) as T;
}

function publicTemplateUrl(path: string) {
  return `/${path.replace(/^public[\\/]/, "").replace(/\\/g, "/")}`;
}

function templateKind(template: DocumentTemplateConfig) {
  return template.fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "รูปภาพ";
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function firstText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (text(value)) return text(value);
  }
  return "";
}

function money(value: unknown) {
  const raw = text(value);
  const n = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return raw;
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function normalizePaymentType(value: unknown) {
  const raw = text(value).toLowerCase();
  if (!raw) return "";
  if (raw.includes("สด") || raw.includes("cash")) return "cash";
  if (raw.includes("ไฟแนนซ์") || raw.includes("finance")) return "finance";
  return text(value);
}

function mapReportToDocument(report: ReportRecord): DocumentData {
  const brand = firstText(report, ["brand", "ยี่ห้อรถ", "ยี่ห้อ"]);
  const model = [brand, firstText(report, ["model"])].filter(Boolean).join(" ");
  const paymentType = normalizePaymentType(firstText(report, ["paymentType", "ประเภทการซื้อ", "การชำระเงิน"]));
  const salePriceRaw = firstText(report, ["salePrice", "ราคาเสนอขายRT", "finalPrice"]);
  const bookingPriceRaw = firstText(report, ["bookingPrice", "เงินจอง"]);
  const financeAmountRaw = firstText(report, ["financeAmount", "ยอดจัด"]);
  const discountRaw = firstText(report, ["discount", "discountPrice", "ส่วนลด"]);
  const netRaw = firstText(report, ["netCarPrice", "ราคาสุทธิ", "finalPrice"]);
  const reportText = firstText(report, ["reportText"]);
  return {
    ...emptyDocumentData,
    customerName: firstText(report, ["customerName", "ชื่อลูกค้า"]),
    idCard: firstText(report, ["idCard", "เลขบัตรประชาชน", "เลขผู้เสียภาษี"]),
    phone: firstText(report, ["phone", "เบอร์โทร"]),
    address: firstText(report, ["address", "ที่อยู่"]),
    customerAddress: firstText(report, ["address", "ที่อยู่"]),
    plate: firstText(report, ["plate", "ทะเบียน"]),
    plateNumber: firstText(report, ["plate", "ทะเบียน"]),
    carBrand: brand,
    carModel: model || firstText(report, ["carModel", "รุ่นรถยนต์", "model"]),
    year: firstText(report, ["year", "ปีจด"]),
    color: firstText(report, ["color", "สี"]),
    salePrice: money(salePriceRaw),
    price: money(salePriceRaw),
    bookingPrice: money(bookingPriceRaw),
    bookingNo: firstText(report, ["id", "bookingNo", "เลขที่ใบจอง"]),
    financeAmount: money(financeAmountRaw),
    deliveryDate: firstText(report, ["deliveryDate", "วันที่ส่งมอบ"]),
    deliveryLocation: firstText(report, ["deliveryLocation", "สถานที่ส่งมอบ"]),
    paymentType,
    sellerName: firstText(report, ["saleName", "ชื่อผู้ขาย"]),
    saleName: firstText(report, ["saleName", "ชื่อผู้ขาย"]),
    signatureName: firstText(report, ["customerName", "ชื่อลูกค้า"]),
    bookingDate: firstText(report, ["createdAt", "วันที่จอง/ขาย"]),
    status: firstText(report, ["status", "สถานะ"]),
    vin: firstText(report, ["vin", "เลขตัวถัง", "เลขตัวรถ"]),
    engineNo: firstText(report, ["engineNo", "เลขเครื่อง"]),
    financeName: firstText(report, ["financeCompany", "financeName", "ไฟแนนซ์"]),
    discountPrice: money(discountRaw || (reportText.match(/ส่วนลด[:：]\s*([\d,]+)/)?.[1] || "")),
    netCarPrice: money(netRaw)
  };
}

function mergeVehicleData(current: DocumentData, vehicle: VehicleRecord): DocumentData {
  const model = [firstText(vehicle, ["brand"]), firstText(vehicle, ["model"])].filter(Boolean).join(" ");
  return {
    ...current,
    plate: firstText(vehicle, ["plate", "ทะเบียน"]) || current.plate,
    plateNumber: firstText(vehicle, ["plate", "ทะเบียน"]) || current.plateNumber,
    carBrand: firstText(vehicle, ["brand", "ยี่ห้อรถ", "ยี่ห้อ"]) || current.carBrand,
    carModel: model || current.carModel,
    year: firstText(vehicle, ["year", "ปีจด"]) || current.year,
    color: firstText(vehicle, ["color", "สี"]) || current.color,
    mileage: firstText(vehicle, ["mileage", "เลขไมล์"]) || current.mileage,
    salePrice: money(firstText(vehicle, ["salePrice", "ราคาเสนอขายRT"])) || current.salePrice,
    price: money(firstText(vehicle, ["salePrice", "ราคาเสนอขายRT"])) || current.price,
    pdiStatus: firstText(vehicle, ["pdiStatus", "สถานะปรับสภาพ PDI"]) || current.pdiStatus,
    pdiNote: firstText(vehicle, ["pdiNote", "หมายเหตุ PDI"]) || current.pdiNote,
    vin: firstText(vehicle, ["vin", "เลขตัวถัง"]) || current.vin,
    engineNo: firstText(vehicle, ["engineNo", "เลขเครื่อง"]) || current.engineNo,
    engineNumber: firstText(vehicle, ["engineNo", "เลขเครื่อง"]) || current.engineNumber
  };
}

function mapOcrResultToDocument(result: Record<string, unknown>): DocumentData {
  const raw = text(result.rawText);
  const plateMatch = raw.match(/[ก-ฮ]{1,3}\s?\d{1,4}/);
  const priceMatch = raw.match(/(?:ราคา|บาท)\D{0,12}([\d,]{4,})/);
  const mileageMatch = raw.match(/(?:ไมล์|เลขไมล์)\D{0,12}([\d,]{3,})/);
  return {
    ...emptyDocumentData,
    customerName: firstText(result, ["name", "companyName", "customerName"]),
    idCard: firstText(result, ["idNumber", "taxId", "idCard"]),
    phone: firstText(result, ["phone"]),
    address: firstText(result, ["address", "companyAddress"]),
    customerAddress: firstText(result, ["address", "companyAddress"]),
    plate: firstText(result, ["plate"]) || (plateMatch ? plateMatch[0] : ""),
    plateNumber: firstText(result, ["plate"]) || (plateMatch ? plateMatch[0] : ""),
    carModel: firstText(result, ["model", "carModel"]),
    color: firstText(result, ["color"]),
    salePrice: firstText(result, ["price", "salePrice"]) || (priceMatch ? priceMatch[1] : ""),
    price: firstText(result, ["price", "salePrice"]) || (priceMatch ? priceMatch[1] : ""),
    mileage: firstText(result, ["mileage"]) || (mileageMatch ? mileageMatch[1] : ""),
    status: firstText(result, ["status"]),
    vin: firstText(result, ["vin"]),
    engineNo: firstText(result, ["engineNo"])
  };
}

export function DocumentCenter() {
  const [templates, setTemplates] = useState<DocumentTemplateConfig[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [templateId, setTemplateId] = useState<DocumentTemplateId>("temporary-receipt");
  const [query, setQuery] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [data, setData] = useState<DocumentData>({ ...emptyDocumentData });
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ templates: DocumentTemplateConfig[] }>("/api/documents/templates").then((res) => setTemplates(res.templates || [])),
      api<{ reports: ReportRecord[] }>("/api/reports/history?type=all").then((res) => setReports(res.reports || [])).catch(() => undefined),
      api<{ vehicles: VehicleRecord[] }>("/api/stock/list?limit=1000").then((res) => setVehicles(res.vehicles || [])).catch(() => undefined)
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ"))
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const selectedTemplate = templates.find((template) => template.id === templateId);
  const autoTemplates = useMemo(
    () => templates.filter((template) => autoTemplateIds.includes(template.id)),
    [templates]
  );

  useEffect(() => {
    if (!autoTemplates.length) return;
    if (!autoTemplateIds.includes(templateId)) {
      setTemplateId(autoTemplates[0].id);
    }
  }, [autoTemplates, templateId]);
  const filteredTemplates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return templates.filter((template) => !term || [template.title, template.description, template.fileName].join(" ").toLowerCase().includes(term));
  }, [query, templates]);

  function update(key: string, value: string) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function selectReport(report: ReportRecord) {
    const mapped = mapReportToDocument(report);
    const vehicle = vehicles.find((item) => text(item.plate).replace(/\s+/g, "") === text(mapped.plate).replace(/\s+/g, ""));
    setData(vehicle ? mergeVehicleData(mapped, vehicle) : mapped);
    setReportQuery([mapped.customerName, mapped.plate].filter(Boolean).join(" · "));
  }

  async function generatePdf(download = false) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (!selectedTemplate) throw new Error("กรุณาเลือกเอกสาร");
      const blob = await api<Blob>("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          data: {
            ...data,
            customerName: data.customerName,
            customerAddress: data.customerAddress || data.address,
            plate: data.plate || data.plateNumber,
            carBrand: data.carBrand,
            carModel: data.carModel,
            salePrice: data.salePrice || data.price,
            price: data.price || data.salePrice,
            paymentType: normalizePaymentType(data.paymentType),
            sellerName: data.sellerName || data.saleName,
            signatureName: data.signatureName || data.customerName
          }
        })
      });
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selectedTemplate.fileName.replace(/\.pdf$/i, "")}-${data.plate || Date.now()}.pdf`;
        link.click();
      }
      setMessage("สร้างเอกสารสำเร็จ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างเอกสารไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  }

  async function exportImage(format: "png" | "jpeg") {
    const canvas = document.createElement("canvas");
    const width = 1200;
    const height = 820;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx || !selectedTemplate) return;
    ctx.fillStyle = "#070a0f";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#16c784";
    ctx.fillRect(0, 0, 10, height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px Arial, Tahoma, sans-serif";
    ctx.fillText("BIG CAR RDD CRM", 54, 78);
    ctx.font = "800 30px Arial, Tahoma, sans-serif";
    ctx.fillText(selectedTemplate.title, 54, 126);
    ctx.font = "600 24px Arial, Tahoma, sans-serif";
    editableFields.slice(0, 12).forEach((field, index) => {
      const y = 190 + index * 46;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(field.label, 54, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(data[field.key] || "-", 340, y);
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format === "png" ? "image/png" : "image/jpeg", 0.92));
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `document-preview-${Date.now()}.${format === "png" ? "png" : "jpg"}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function saveDraft() {
    setMessage("โหมด Draft ถูกย้ายไปหน้า Setting แล้ว");
  }

  async function handleOcrFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const ocrPayload = await documentFileToOcrPayloads(file);
      const results = [];
      for (const [index, payload] of ocrPayload.payloads.entries()) {
        setMessage(ocrPayload.sourceType === "pdf" ? `กำลัง OCR PDF หน้า ${index + 1}/${ocrPayload.processedPages}` : "กำลัง OCR รูปภาพ");
        const res = await api<{ result: Record<string, unknown> }>("/api/ocr/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, buyerType: "individual" })
        });
        results.push(res.result);
      }
      const merged = mergeOcrRecords(results);
      setData((current) => ({ ...current, ...mapOcrResultToDocument(merged) }));
      setMessage(
        ocrPayload.sourceType === "pdf"
          ? `อ่าน OCR PDF แล้ว ${ocrPayload.processedPages}/${ocrPayload.pageCount} หน้า กรุณาตรวจข้อมูลก่อน Export`
          : "อ่าน OCR แล้ว กรุณาตรวจและแก้ไขก่อน Export"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR ไม่สำเร็จ");
    } finally {
      setWorking(false);
      event.target.value = "";
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="Document Center"
        subtitle="เอกสาร"
        actions={
          <div className="flex flex-wrap gap-2">
            <TopMenuButton href="/documents#document-generator-v2" icon={<FileText size={18} />}>สร้างเอกสาร</TopMenuButton>
          </div>
        }
      />

      {(message || error) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      {loading ? (
        <SectionCard>
          <div className="py-10 text-center text-soft"><Loader2 className="mx-auto mb-2 animate-spin text-brand" />กำลังโหลด Document Center</div>
        </SectionCard>
      ) : null}

      {!loading ? (
        <section className="space-y-4">
          <SectionCard icon={<Download size={18} />}>
            <SearchField icon={<Search size={18} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นชื่อเอกสาร / หมวดหมู่ / PDF" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map((template) => {
                const href = publicTemplateUrl(template.backgroundPath || `public/document-templates/${template.fileName}`);
                return (
                  <article key={template.id} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{templateKind(template)}</p>
                    <h2 className="mt-1 min-h-12 text-base font-black text-white">{template.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-soft">{template.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <a href={href} target="_blank" className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-white">
                        <Eye size={16} /> ดูตัวอย่าง
                      </a>
                      <a href={href} download className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink">
                        <Download size={16} /> ดาวน์โหลด
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </SectionCard>
        </section>
      ) : null}
    </PageContainer>
  );
}
