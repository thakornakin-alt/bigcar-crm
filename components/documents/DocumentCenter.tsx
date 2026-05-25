"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileImage, FileText, Loader2, Save, Search, Upload } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { DocumentTemplateConfig, DocumentTemplateId } from "@/lib/documents/document-types";

type DocumentHistoryItem = {
  id: string;
  templateTitle: string;
  createdAt: string;
  customerName: string;
  plate: string;
  vehicleLabel: string;
  createdBy: string;
};

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
type ActiveTab = "download" | "create" | "ocr" | "drafts";

const draftKey = "bigcar-document-drafts-v1";

const emptyDocumentData: DocumentData = {
  customerName: "",
  phone: "",
  plateNumber: "",
  plate: "",
  carModel: "",
  year: "",
  color: "",
  mileage: "",
  price: "",
  salePrice: "",
  saleName: "",
  sellerName: "",
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
  { key: "phone", label: "เบอร์โทร", optional: true },
  { key: "plate", label: "ทะเบียน" },
  { key: "carModel", label: "รุ่นรถยนต์" },
  { key: "year", label: "ปีจด" },
  { key: "color", label: "สี" },
  { key: "mileage", label: "เลขไมล์" },
  { key: "salePrice", label: "ราคาเสนอขายRT" },
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

function mapReportToDocument(report: ReportRecord): DocumentData {
  const model = [firstText(report, ["brand"]), firstText(report, ["model"])].filter(Boolean).join(" ");
  return {
    ...emptyDocumentData,
    customerName: firstText(report, ["customerName", "ชื่อลูกค้า"]),
    phone: firstText(report, ["phone", "เบอร์โทร"]),
    plate: firstText(report, ["plate", "ทะเบียน"]),
    plateNumber: firstText(report, ["plate", "ทะเบียน"]),
    carModel: model || firstText(report, ["carModel", "รุ่นรถยนต์", "model"]),
    year: firstText(report, ["year", "ปีจด"]),
    color: firstText(report, ["color", "สี"]),
    salePrice: money(firstText(report, ["salePrice", "ราคาเสนอขายRT", "finalPrice"])),
    price: money(firstText(report, ["salePrice", "ราคาเสนอขายRT", "finalPrice"])),
    sellerName: firstText(report, ["saleName", "ชื่อผู้ขาย"]),
    saleName: firstText(report, ["saleName", "ชื่อผู้ขาย"]),
    bookingDate: firstText(report, ["createdAt", "วันที่จอง/ขาย"]),
    status: firstText(report, ["status", "สถานะ"])
  };
}

function mergeVehicleData(current: DocumentData, vehicle: VehicleRecord): DocumentData {
  const model = [firstText(vehicle, ["brand"]), firstText(vehicle, ["model"])].filter(Boolean).join(" ");
  return {
    ...current,
    plate: firstText(vehicle, ["plate", "ทะเบียน"]) || current.plate,
    plateNumber: firstText(vehicle, ["plate", "ทะเบียน"]) || current.plateNumber,
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
    phone: firstText(result, ["phone"]),
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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function loadDrafts(): Array<{ id: string; name: string; templateId: DocumentTemplateId; data: DocumentData; updatedAt: string }> {
  try {
    return JSON.parse(window.localStorage.getItem(draftKey) || "[]");
  } catch {
    return [];
  }
}

export function DocumentCenter() {
  const [tab, setTab] = useState<ActiveTab>("download");
  const [templates, setTemplates] = useState<DocumentTemplateConfig[]>([]);
  const [history, setHistory] = useState<DocumentHistoryItem[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [templateId, setTemplateId] = useState<DocumentTemplateId>("sale-summary");
  const [query, setQuery] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [data, setData] = useState<DocumentData>({ ...emptyDocumentData });
  const [previewUrl, setPreviewUrl] = useState("");
  const [drafts, setDrafts] = useState<Array<{ id: string; name: string; templateId: DocumentTemplateId; data: DocumentData; updatedAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ templates: DocumentTemplateConfig[] }>("/api/documents/templates").then((res) => setTemplates(res.templates || [])),
      api<{ history: DocumentHistoryItem[] }>("/api/documents/history").then((res) => setHistory(res.history || [])).catch(() => undefined),
      api<{ reports: ReportRecord[] }>("/api/reports/history?type=all").then((res) => setReports(res.reports || [])).catch(() => undefined),
      api<{ vehicles: VehicleRecord[] }>("/api/stock/list?limit=1000").then((res) => setVehicles(res.vehicles || [])).catch(() => undefined)
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ"))
      .finally(() => {
        setDrafts(loadDrafts());
        setLoading(false);
      });
  }, []);

  const selectedTemplate = templates.find((template) => template.id === templateId);
  const filteredTemplates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return templates.filter((template) => !term || [template.title, template.description, template.fileName].join(" ").toLowerCase().includes(term));
  }, [query, templates]);
  const filteredReports = useMemo(() => {
    const term = reportQuery.trim().toLowerCase().replace(/\s+/g, "");
    return reports.filter((report) => !term || [report.customerName, report.plate, report.model, report.phone].join("").toLowerCase().replace(/\s+/g, "").includes(term)).slice(0, 10);
  }, [reportQuery, reports]);

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
        body: JSON.stringify({ templateId, data: { ...data, customerName: data.customerName, plate: data.plate || data.plateNumber, carModel: data.carModel, salePrice: data.salePrice || data.price, sellerName: data.sellerName || data.saleName } })
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
    const item = {
      id: `draft-${Date.now()}`,
      name: `${selectedTemplate?.title || "เอกสาร"} · ${data.customerName || data.plate || "ยังไม่ระบุ"}`,
      templateId,
      data,
      updatedAt: new Date().toISOString()
    };
    const next = [item, ...drafts].slice(0, 20);
    window.localStorage.setItem(draftKey, JSON.stringify(next));
    setDrafts(next);
    setMessage("บันทึก Draft แล้ว");
  }

  async function handleOcrFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (file.type === "application/pdf") {
        throw new Error("อัปโหลด PDF ได้แล้ว แต่ OCR PDF ตรง ๆ ยังต้องเพิ่มตัวแปลง PDF เป็นภาพก่อน ตอนนี้ใช้รูปถ่าย/รูปสแกนเพื่อ OCR ได้จริง");
      }
      if (!file.type.startsWith("image/")) throw new Error("รองรับ OCR จากรูปภาพ หรือ PDF สำหรับเก็บไฟล์เท่านั้น");
      const base64 = await fileToBase64(file);
      const res = await api<{ result: Record<string, unknown> }>("/api/ocr/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type, buyerType: "individual" })
      });
      setData((current) => ({ ...current, ...mapOcrResultToDocument(res.result) }));
      setTab("create");
      setMessage("อ่าน OCR แล้ว กรุณาตรวจและแก้ไขก่อน Export");
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
        subtitle="ดาวน์โหลดเอกสารเปล่า สร้างเอกสารอัตโนมัติ OCR และ Draft ในหน้าเดียว"
        actions={<TopMenuButton href="/documents/templates" icon={<FileText size={18} />}>ตั้งค่า Template</TopMenuButton>}
      />

      {(message || error) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["download", "ดาวน์โหลดเอกสาร"],
          ["create", "สร้างเอกสาร"],
          ["ocr", "OCR Scanner"],
          ["drafts", "ประวัติ / Draft"]
        ].map(([id, label]) => (
          <FilterChip key={id} active={tab === id} onClick={() => setTab(id as ActiveTab)}>
            {label}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <SectionCard>
          <div className="py-10 text-center text-soft"><Loader2 className="mx-auto mb-2 animate-spin text-brand" />กำลังโหลด Document Center</div>
        </SectionCard>
      ) : null}

      {!loading && tab === "download" ? (
        <section className="space-y-4">
          <SectionCard title="ดาวน์โหลดเอกสารเปล่า" icon={<Download size={18} />}>
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

      {!loading && tab === "create" ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-4">
            <SectionCard title="เลือกเอกสาร / รายงานจอง" icon={<FileText size={18} />}>
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value as DocumentTemplateId)} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand">
                {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
              </select>
              <SearchField value={reportQuery} onChange={(event) => setReportQuery(event.target.value)} placeholder="ค้นรายงานจอง / ทะเบียน / ลูกค้า" />
              <div className="grid gap-2">
                {filteredReports.map((report) => (
                  <button key={report.id || `${report.plate}-${report.createdAt}`} type="button" onClick={() => selectReport(report)} className="rounded-lg border border-line bg-[#0b0d11] p-3 text-left transition hover:border-brand">
                    <p className="font-black text-white">{report.customerName || "-"} · {report.plate || "-"}</p>
                    <p className="mt-1 text-sm text-soft">{[report.brand, report.model, report.year].filter(Boolean).join(" ")} · {report.saleName || "-"}</p>
                  </button>
                ))}
                {!filteredReports.length ? <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-soft">ไม่พบรายงานจอง กรอกข้อมูลเองได้ด้านขวา</p> : null}
              </div>
            </SectionCard>
          </section>

          <section className="space-y-4">
            <SectionCard title="ข้อมูลก่อน Export" icon={<FileText size={18} />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {editableFields.map((field) => (
                  <label key={field.key} className={field.key === "pdiNote" ? "sm:col-span-2" : ""}>
                    <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">{field.label}{field.optional ? " (optional)" : ""}</span>
                    <input value={data[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand" />
                  </label>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <button type="button" onClick={() => generatePdf(false)} disabled={working} className="min-h-11 rounded-lg border border-brand/40 bg-brand/10 px-3 font-black text-brand disabled:opacity-60">Preview PDF</button>
                <button type="button" onClick={() => generatePdf(true)} disabled={working} className="min-h-11 rounded-lg bg-brand px-3 font-black text-ink disabled:opacity-60">Export PDF</button>
                <button type="button" onClick={() => exportImage("png")} className="min-h-11 rounded-lg border border-line px-3 font-bold text-white">PNG</button>
                <button type="button" onClick={saveDraft} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 font-bold text-white"><Save size={16} /> Draft</button>
              </div>
            </SectionCard>
            <SectionCard title="Preview" icon={<Eye size={18} />}>
              {previewUrl ? <iframe title="Document preview" src={previewUrl} className="h-[70vh] w-full rounded-lg border border-line bg-white" /> : <div className="rounded-lg border border-dashed border-line p-8 text-center text-soft">กด Preview PDF เพื่อดูเอกสารก่อน Export</div>}
            </SectionCard>
          </section>
        </div>
      ) : null}

      {!loading && tab === "ocr" ? (
        <SectionCard title="OCR Scanner" icon={<Upload size={18} />}>
          <p className="rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-6 text-soft">
            OCR รูปภาพใช้งานได้จริงผ่านระบบเดิม ส่วน PDF OCR ตรง ๆ ยังต้องเพิ่มตัวแปลง PDF เป็นภาพก่อน ระบบจะแจ้ง error ชัดเจนและไม่ทำให้ข้อมูลเดิมเสีย
          </p>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-brand/50 bg-brand/10 p-4 text-center text-brand">
            <Upload size={26} />
            <span className="mt-2 font-black">อัปโหลด / ถ่ายรูปเอกสาร</span>
            <span className="mt-1 text-xs text-soft">รองรับรูปภาพ, PDF จะรับไฟล์แต่ยังไม่ OCR ตรง</span>
            <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleOcrFile} className="hidden" />
          </label>
          {working ? <p className="text-sm text-soft"><Loader2 className="mr-2 inline animate-spin text-brand" />กำลัง OCR...</p> : null}
        </SectionCard>
      ) : null}

      {!loading && tab === "drafts" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Draft" icon={<Save size={18} />}>
            {drafts.length ? drafts.map((draft) => (
              <button key={draft.id} type="button" onClick={() => { setTemplateId(draft.templateId); setData(draft.data); setTab("create"); }} className="w-full rounded-lg border border-line bg-[#0b0d11] p-3 text-left transition hover:border-brand">
                <p className="font-black text-white">{draft.name}</p>
                <p className="mt-1 text-xs text-soft">{new Date(draft.updatedAt).toLocaleString("th-TH")}</p>
              </button>
            )) : <p className="rounded-lg border border-dashed border-line p-6 text-center text-soft">ยังไม่มี Draft</p>}
          </SectionCard>
          <SectionCard title="ประวัติเอกสารล่าสุด" icon={<FileImage size={18} />}>
            {history.length ? history.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <p className="font-black text-white">{item.templateTitle}</p>
                <p className="mt-1 text-sm text-soft">{item.customerName || "-"} · {item.plate || "-"} · {item.vehicleLabel || "-"}</p>
                <p className="mt-1 text-xs text-soft">สร้างโดย {item.createdBy || "-"} · {new Date(item.createdAt).toLocaleString("th-TH")}</p>
              </div>
            )) : <p className="rounded-lg border border-dashed border-line p-6 text-center text-soft">ยังไม่มีประวัติ</p>}
          </SectionCard>
        </div>
      ) : null}
    </PageContainer>
  );
}
