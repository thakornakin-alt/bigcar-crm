"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileImage, FileText, Loader2, Printer, Save, Search } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard } from "@/app/components/ui";
import type { DocumentTemplateConfig, DocumentTemplateId } from "@/lib/documents/document-types";
import type { ReportHistoryItem } from "@/lib/types";

type Customer = {
  no?: string;
  name: string;
  phone: string;
  car?: string;
  note?: string;
};

type Vehicle = {
  plate: string;
  brand?: string;
  model?: string;
  year?: string;
  color?: string;
  salePrice?: string;
  vin?: string;
  parkingLocation?: string;
  mileage?: string;
};

type DocumentFormData = Record<string, string>;
const autoTemplateIds: DocumentTemplateId[] = ["contract", "temporary-receipt"];
const tuningStorageKey = "bigcar-document-image-tuning-v1";
type ImageTuning = { offsetX: number; offsetY: number; textOffsetX: number; textOffsetY: number; scale: number };
const defaultTuning: ImageTuning = { offsetX: 0, offsetY: 0, textOffsetX: 0, textOffsetY: 0, scale: 1 };

const initialData: DocumentFormData = {
  customerName: "",
  idCard: "",
  phone: "",
  address: "",
  email: "",
  occupation: "",
  transactionPlace: "",
  transactionDate: "",
  age: "",
  houseNo: "",
  villageNo: "",
  road: "",
  subDistrict: "",
  district: "",
  province: "",
  carBrand: "",
  carModel: "",
  year: "",
  productionYear: "",
  color: "",
  plate: "",
  vin: "",
  engineNo: "",
  salePrice: "",
  bookingPrice: "",
  financeAmount: "",
  installment: "",
  deliveryLocation: "",
  deliveryDate: "",
  bookingDate: "",
  bookingNo: "",
  discountPrice: "",
  netCarPrice: "",
  financeCompany: "",
  paymentType: "finance",
  sellerName: "",
  sellerPhone: "",
  sellerLineId: "",
  approverName: "",
  signatureName: ""
};

const fieldLabels: Record<string, string> = {
  customerName: "ชื่อ-นามสกุล",
  idCard: "เลขบัตรประชาชน",
  phone: "เบอร์โทร",
  address: "ที่อยู่",
  email: "อีเมล",
  occupation: "อาชีพ",
  transactionPlace: "สถานที่ทำรายการ",
  transactionDate: "วันที่ทำรายการ",
  age: "อายุ",
  houseNo: "บ้านเลขที่",
  villageNo: "หมู่ที่",
  road: "ถนน",
  subDistrict: "ตำบล/แขวง",
  district: "อำเภอ/เขต",
  province: "จังหวัด",
  carBrand: "ยี่ห้อ",
  carModel: "รุ่น",
  year: "ปีจด",
  productionYear: "ปีผลิต",
  color: "สี",
  plate: "ทะเบียน",
  vin: "เลขตัวถัง",
  engineNo: "เลขเครื่อง",
  salePrice: "ราคาเสนอขาย",
  bookingPrice: "เงินจอง",
  financeAmount: "ยอดจัด",
  installment: "ค่างวด",
  deliveryLocation: "สถานที่ส่งมอบ",
  deliveryDate: "วันที่ส่งมอบ",
  bookingDate: "วันที่ใบจอง",
  bookingNo: "เลขที่ใบจอง",
  discountPrice: "ส่วนลด",
  netCarPrice: "ราคาสุทธิ",
  financeCompany: "ไฟแนนซ์",
  paymentType: "ช่องทางชำระ",
  sellerName: "ชื่อเซลล์",
  sellerPhone: "เบอร์เซลล์",
  sellerLineId: "LINE ID",
  approverName: "ผู้อนุมัติ",
  signatureName: "ชื่อผู้ลงนาม"
};

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

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function money(value?: string) {
  const n = Number(String(value || "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return value || "";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n);
}

function vehicleLabel(vehicle: Vehicle) {
  return [vehicle.plate, vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" / ");
}

function formatDateForDoc(value: string) {
  if (!value) return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return value;
}

function readTuning(templateId: DocumentTemplateId): ImageTuning {
  try {
    const raw = window.localStorage.getItem(tuningStorageKey);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ImageTuning>) : {};
    return { ...defaultTuning, ...(parsed[templateId] || {}) };
  } catch {
    return { ...defaultTuning };
  }
}

function writeTuning(templateId: DocumentTemplateId, tuning: ImageTuning) {
  try {
    const raw = window.localStorage.getItem(tuningStorageKey);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ImageTuning>) : {};
    parsed[templateId] = tuning;
    window.localStorage.setItem(tuningStorageKey, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export default function DocumentCreatePage() {
  const previewSectionRef = useRef<HTMLDivElement | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplateConfig[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [templateId, setTemplateId] = useState<DocumentTemplateId>("temporary-receipt");
  const [customerQuery, setCustomerQuery] = useState("");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [bookingQuery, setBookingQuery] = useState("");
  const [bookingReports, setBookingReports] = useState<ReportHistoryItem[]>([]);
  const [data, setData] = useState<DocumentFormData>({ ...initialData, transactionDate: todayInput(), bookingDate: todayInput() });
  const [previewUrl, setPreviewUrl] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageTuning, setImageTuning] = useState<ImageTuning>(defaultTuning);
  const [loading, setLoading] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [checkingSystem, setCheckingSystem] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ templates: DocumentTemplateConfig[] }>("/api/documents/templates")
      .then((res) => setTemplates(res.templates || []))
      .catch((err) => setError(err.message));
    api<{ customers: Customer[] }>("/api/customers")
      .then((res) => setCustomers(res.customers || []))
      .catch(() => undefined);
    api<{ vehicles: Vehicle[] }>("/api/stock/list?limit=1000")
      .then((res) => setVehicles(res.vehicles || []))
      .catch(() => undefined);
    api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=booking")
      .then((res) => setBookingReports((res.reports || []).filter((report) => report.type === "booking" && report.status !== "deleted")))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [previewUrl, imagePreviewUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setImageTuning(readTuning(templateId));
  }, [templateId]);

  const selectedTemplate = templates.find((template) => template.id === templateId);
  const autoTemplates = useMemo(
    () => templates.filter((template) => autoTemplateIds.includes(template.id)),
    [templates]
  );
  const visibleFields = useMemo(() => {
    const fields = selectedTemplate ? Object.keys(selectedTemplate.fields) : [];
    const core = [
      "customerName",
      "phone",
      "idCard",
      "address",
      "plate",
      "carBrand",
      "carModel",
      "year",
      "color",
      "vin",
      "salePrice",
      "bookingPrice",
      "financeAmount",
      "deliveryLocation",
      "sellerName",
      "approverName"
    ];
    return Array.from(new Set([...fields, ...core])).filter((key) => key in fieldLabels);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!autoTemplates.length) return;
    if (!autoTemplateIds.includes(templateId)) {
      setTemplateId(autoTemplates[0].id);
    }
  }, [autoTemplates, templateId]);

  const filteredCustomers = useMemo(() => {
    const term = customerQuery.trim().toLowerCase();
    return customers
      .filter((customer) => !term || [customer.name, customer.phone, customer.car].join(" ").toLowerCase().includes(term))
      .slice(0, 8);
  }, [customers, customerQuery]);

  const filteredVehicles = useMemo(() => {
    const term = vehicleQuery.trim().toLowerCase().replace(/\s+/g, "");
    return vehicles
      .filter((vehicle) => {
        const hay = [vehicle.plate, vehicle.brand, vehicle.model, vehicle.year, vehicle.color, vehicle.parkingLocation].join("").toLowerCase().replace(/\s+/g, "");
        return !term || hay.includes(term);
      })
      .slice(0, 8);
  }, [vehicles, vehicleQuery]);

  const filteredBookingReports = useMemo(() => {
    const term = bookingQuery.trim().toLowerCase().replace(/\s+/g, "");
    return bookingReports
      .filter((report) => {
        const hay = [report.customerName, report.phone, report.plate, report.model, report.id].join("").toLowerCase().replace(/\s+/g, "");
        return !term || hay.includes(term);
      })
      .slice(0, 8);
  }, [bookingReports, bookingQuery]);

  function update(key: string, value: string) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function selectCustomer(customer: Customer) {
    setData((current) => ({
      ...current,
      customerName: customer.name || current.customerName,
      phone: customer.phone || current.phone,
      carModel: current.carModel || customer.car || "",
      signatureName: customer.name || current.signatureName
    }));
    setCustomerQuery(customer.name);
  }

  function selectVehicle(vehicle: Vehicle) {
    setData((current) => ({
      ...current,
      plate: vehicle.plate || current.plate,
      carBrand: vehicle.brand || current.carBrand,
      carModel: vehicle.model || current.carModel,
      year: vehicle.year || current.year,
      color: vehicle.color || current.color,
      vin: vehicle.vin || current.vin,
      salePrice: money(vehicle.salePrice) || current.salePrice,
      deliveryLocation: vehicle.parkingLocation || current.deliveryLocation
    }));
    setVehicleQuery(vehicleLabel(vehicle));
  }

  function selectBookingReport(report: ReportHistoryItem) {
    const salePrice = money(report.reportText.match(/ราคาขาย[:：]\s*([\d,]+)/)?.[1] || "");
    const discount = money(report.reportText.match(/ส่วนลด[:：]\s*([\d,]+)/)?.[1] || "");
    const matchedVehicle = vehicles.find((vehicle) => String(vehicle.plate || "").replace(/\s+/g, "") === String(report.plate || "").replace(/\s+/g, ""));
    setData((current) => ({
      ...current,
      bookingNo: report.id || current.bookingNo,
      bookingDate: report.createdAt ? String(report.createdAt).slice(0, 10) : current.bookingDate || todayInput(),
      transactionDate: report.createdAt ? String(report.createdAt).slice(0, 10) : current.transactionDate || todayInput(),
      customerName: report.customerName || current.customerName,
      phone: report.phone || current.phone,
      idCard: report.idCard || current.idCard,
      plate: report.plate || current.plate,
      carBrand: report.brand || matchedVehicle?.brand || current.carBrand,
      carModel: report.model || matchedVehicle?.model || current.carModel,
      year: report.year || matchedVehicle?.year || current.year,
      color: report.color || matchedVehicle?.color || current.color,
      sellerName: report.saleName || current.sellerName,
      salePrice: salePrice || current.salePrice,
      discountPrice: discount || current.discountPrice,
      vin: matchedVehicle?.vin || current.vin,
      deliveryLocation: matchedVehicle?.parkingLocation || current.deliveryLocation
    }));
    setBookingQuery(`${report.id} / ${report.customerName}`);
  }

  async function generatePdfBlob() {
    if (!selectedTemplate) throw new Error("กรุณาเลือกประเภทเอกสาร");
    if (!data.customerName || !data.plate) throw new Error("กรุณาเลือกข้อมูลรายงานจองอย่างน้อย ชื่อลูกค้า + ทะเบียน");
    return await api<Blob>("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, data })
      });
  }

  async function renderPdfPageToPng(pdfBlob: Blob) {
    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    }
    const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas ไม่พร้อมใช้งาน");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await firstPage.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
    if (!blob) throw new Error("แปลง PDF เป็นรูปไม่สำเร็จ");
    return blob;
  }

  async function generatePdf(download = false) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const template = selectedTemplate;
      if (!template) throw new Error("กรุณาเลือกประเภทเอกสาร");
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      if (download) {
        const safeName = [template.fileName.replace(/\.pdf$/i, ""), data.customerName || "customer", data.plate || "no-plate"]
          .join("-")
          .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, "-")
          .replace(/\s+/g, "-")
          .slice(0, 120);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${safeName}.pdf`;
        link.click();
      }
      setMessage("สร้าง PDF สำเร็จ");
      setTimeout(() => previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างเอกสารไม่สำเร็จ กรุณาตรวจข้อมูลและลองใหม่อีกครั้ง");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
      return "";
    } finally {
      setLoading(false);
    }
  }

  async function printPdf() {
    const url = previewUrl || await generatePdf(false);
    if (!url) return;
    try {
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.src = url;
      document.body.appendChild(frame);
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          generatePdf(true).catch(() => undefined);
        } finally {
          setTimeout(() => frame.remove(), 1000);
        }
      };
    } catch {
      await generatePdf(true);
    }
  }

  async function generateDocumentImage(download = false) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const template = selectedTemplate;
      if (!template) throw new Error("กรุณาเลือกประเภทเอกสาร");
      const pdfBlob = await generatePdfBlob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(pdfUrl);

      const imageBlob = await renderPdfPageToPng(pdfBlob);
      const url = URL.createObjectURL(imageBlob);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(url);
      if (download) {
        const safeName = [template.fileName.replace(/\.pdf$/i, ""), data.customerName || "customer", data.plate || "no-plate"]
          .join("-")
          .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, "-")
          .replace(/\s+/g, "-")
          .slice(0, 120);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${safeName}.png`;
        link.click();
      }
      setMessage("สร้างรูปเอกสารจาก PDF สำเร็จ");
      setTimeout(() => previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างรูปเอกสารไม่สำเร็จ");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
      return "";
    } finally {
      setLoading(false);
    }
  }

  async function saveHistory() {
    setSavingHistory(true);
    setError("");
    try {
      if (!selectedTemplate) throw new Error("กรุณาเลือกประเภทเอกสาร");
      await api("/api/documents/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          templateTitle: selectedTemplate.title,
          customerName: data.customerName,
          plate: data.plate,
          vehicleLabel: [data.carBrand, data.carModel, data.year].filter(Boolean).join(" "),
          fileName: selectedTemplate.fileName,
          referencePath: `document://${templateId}/${data.plate || "no-plate"}`
        })
      });
      setMessage("บันทึกประวัติเอกสารแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกประวัติไม่สำเร็จ");
    } finally {
      setSavingHistory(false);
    }
  }

  async function checkDocumentSystem() {
    setCheckingSystem(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ ok: boolean; checks?: Array<{ templateId: string; ok: boolean; detail: string }> }>("/api/documents/health");
      const lines = (result.checks || []).map((check) => `${check.templateId}: ${check.ok ? "ผ่าน" : "ไม่ผ่าน"} (${check.detail})`);
      if (result.ok) {
        setMessage(`ระบบเอกสารพร้อมใช้งาน: ${lines.join(" | ")}`);
      } else {
        setError(`ระบบเอกสารยังไม่พร้อม: ${lines.join(" | ")}`);
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทดสอบระบบเอกสารไม่สำเร็จ");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } finally {
      setCheckingSystem(false);
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="สร้างเอกสาร PDF"
        subtitle="เลือกข้อมูลลูกค้าและรถ แล้วเติมลงแบบฟอร์ม A4 อัตโนมัติ · build 2fe4b4f"
      />

      {(message || error) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="ประเภทเอกสาร" icon={<FileText size={18} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {autoTemplates.map((template) => (
                <FilterChip key={template.id} active={template.id === templateId} onClick={() => setTemplateId(template.id)}>
                  {template.title}
                </FilterChip>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="ปรับตำแหน่งฟอร์ม (Pixel Tuning)" icon={<FileImage size={18} />}>
            <p className="mb-3 text-sm text-soft">จูนเฉพาะหน้านี้สำหรับ 2 ฟอร์มหลัก ค่าจะจำตาม template อัตโนมัติ</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => { const next = { ...imageTuning, offsetX: imageTuning.offsetX - 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ฟอร์มซ้าย 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, offsetX: imageTuning.offsetX + 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ฟอร์มขวา 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, offsetY: imageTuning.offsetY - 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ฟอร์มขึ้น 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, offsetY: imageTuning.offsetY + 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ฟอร์มลง 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, textOffsetX: imageTuning.textOffsetX - 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ตัวอักษรซ้าย 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, textOffsetX: imageTuning.textOffsetX + 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ตัวอักษรขวา 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, textOffsetY: imageTuning.textOffsetY - 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ตัวอักษรขึ้น 2px</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, textOffsetY: imageTuning.textOffsetY + 2 }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ตัวอักษรลง 2px</button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => { const next = { ...imageTuning, scale: Math.max(0.96, imageTuning.scale - 0.002) }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ย่อฟอร์ม</button>
              <button type="button" onClick={() => { const next = { ...imageTuning, scale: Math.min(1.04, imageTuning.scale + 0.002) }; setImageTuning(next); writeTuning(templateId, next); }} className="min-h-10 rounded-lg border border-line px-3 font-bold text-white">ขยายฟอร์ม</button>
              <button type="button" onClick={() => { setImageTuning(defaultTuning); writeTuning(templateId, defaultTuning); }} className="min-h-10 rounded-lg bg-brand px-3 font-black text-ink">รีเซ็ต</button>
            </div>
          </SectionCard>

          <SectionCard title="เลือกลูกค้า" icon={<Search size={18} />}>
            <SearchField value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="ค้นชื่อลูกค้า / เบอร์ / รุ่นที่สนใจ" />
            <div className="grid gap-2">
              {filteredCustomers.map((customer) => (
                <button key={`${customer.no}-${customer.phone}`} type="button" onClick={() => selectCustomer(customer)} className="rounded-lg border border-line bg-[#0b0d11] p-3 text-left transition hover:border-brand">
                  <p className="font-black text-white">{customer.name}</p>
                  <p className="mt-1 text-sm text-soft">{customer.phone || "-"} · {customer.car || "-"}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="เลือกรถ" icon={<Search size={18} />}>
            <SearchField value={vehicleQuery} onChange={(event) => setVehicleQuery(event.target.value)} placeholder="ค้นทะเบียน / รุ่น / ปี / Location" />
            <div className="grid gap-2">
              {filteredVehicles.map((vehicle) => (
                <button key={`${vehicle.plate}-${vehicle.vin}`} type="button" onClick={() => selectVehicle(vehicle)} className="rounded-lg border border-line bg-[#0b0d11] p-3 text-left transition hover:border-brand">
                  <p className="font-black text-white">{vehicle.plate || "ไม่ระบุทะเบียน"}</p>
                  <p className="mt-1 text-sm text-soft">{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ")} · {vehicle.salePrice ? `${money(vehicle.salePrice)} บาท` : "-"}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="เลือกรายงานจอง" icon={<Search size={18} />}>
            <SearchField value={bookingQuery} onChange={(event) => setBookingQuery(event.target.value)} placeholder="ค้นเลขที่ใบจอง / ทะเบียน / ชื่อลูกค้า" />
            <div className="grid gap-2">
              {filteredBookingReports.map((report) => (
                <button key={report.id} type="button" onClick={() => selectBookingReport(report)} className="rounded-lg border border-line bg-[#0b0d11] p-3 text-left transition hover:border-brand">
                  <p className="font-black text-white">{report.id} · {report.customerName}</p>
                  <p className="mt-1 text-sm text-soft">{report.plate || "-"} · {[report.brand, report.model, report.year].filter(Boolean).join(" ") || "-"}</p>
                </button>
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="ข้อมูลที่จะเติม" icon={<FileText size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleFields.map((key) => (
                <label key={key} className={key === "address" ? "sm:col-span-2" : ""}>
                  <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">{fieldLabels[key] || key}</span>
                  {key === "paymentType" ? (
                    <select value={data[key] || ""} onChange={(event) => update(key, event.target.value)} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand">
                      <option value="finance">จัดไฟแนนซ์</option>
                      <option value="cash">ซื้อสด</option>
                    </select>
                  ) : (
                    <input
                      type={key.toLowerCase().includes("date") ? "date" : "text"}
                      value={data[key] || ""}
                      onChange={(event) => update(key, event.target.value)}
                      className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <button type="button" onClick={checkDocumentSystem} disabled={checkingSystem || loading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 font-bold text-white disabled:opacity-60">
                {checkingSystem ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                ทดสอบระบบ
              </button>
              <button type="button" onClick={() => generatePdf(false)} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 font-black text-brand disabled:opacity-60">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                Preview PDF
              </button>
              <button type="button" onClick={() => generatePdf(true)} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 font-black text-ink disabled:opacity-60">
                <Download size={18} />
                เซฟ PDF
              </button>
              <button type="button" onClick={() => generateDocumentImage(false)} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 font-black text-brand disabled:opacity-60">
                <FileImage size={18} />
                Preview รูป
              </button>
              <button type="button" onClick={() => generateDocumentImage(true)} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 font-black text-ink disabled:opacity-60">
                <Download size={18} />
                เซฟ PNG
              </button>
              <button type="button" onClick={printPdf} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 font-bold text-white">
                <Printer size={18} />
                Print
              </button>
              <button type="button" onClick={saveHistory} disabled={savingHistory} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 font-bold text-white disabled:opacity-60">
                {savingHistory ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save History
              </button>
            </div>
          </SectionCard>

          <div ref={previewSectionRef}>
          <SectionCard title="Preview เอกสาร" icon={<Eye size={18} />}>
            {imagePreviewUrl ? (
              <div className="mb-4 overflow-hidden rounded-lg border border-line bg-white">
                <img src={imagePreviewUrl} alt="Document image preview" className="h-auto w-full" />
              </div>
            ) : null}
            {previewUrl ? (
              <iframe title="PDF Preview" src={previewUrl} className="h-[72vh] w-full rounded-lg border border-line bg-white" />
            ) : (
              <div className="rounded-lg border border-dashed border-line bg-[#0b0d11] px-4 py-10 text-center text-soft">
                กด Preview PDF หรือ Preview รูป เพื่อดูเอกสารก่อนเซฟ
              </div>
            )}
          </SectionCard>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
