"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CheckCircle2, ChevronDown, Clipboard, Eye, FileText, ImagePlus, Loader2, Save, Search, X } from "lucide-react";
import { buildSalesPaymentDetail, renderSalesReport } from "@/lib/sales-report";
import { normalizeCarYear } from "@/lib/format";
import type { BookingAttachment, BookingReport, SalesReportInput } from "@/lib/types";

type VehiclePhotoMode = "standard" | "van";

type SalesAttachmentCategory =
  | "carFrontLeft"
  | "carFrontRight"
  | "carRearLeft"
  | "carRearRight"
  | "vanSeatFront"
  | "vanSeatRear"
  | "odometer"
  | "temporaryReceipt"
  | "bookingTransferSlip"
  | "additionalSlip1"
  | "additionalSlip2"
  | "additionalSlip3"
  | "additionalSlip4"
  | "additionalSlip5"
  | "additionalSlip6";

type LocalAttachment = {
  id: string;
  name: string;
  type: string;
  url: string;
};

const salesAttachmentLabels: Record<SalesAttachmentCategory, string> = {
  carFrontLeft: "รูปรถ 4 มุม: หน้าซ้าย",
  carFrontRight: "รูปรถ 4 มุม: หน้าขวา",
  carRearLeft: "รูปรถ 4 มุม: หลังซ้าย",
  carRearRight: "รูปรถ 4 มุม: หลังขวา",
  vanSeatFront: "รถตู้: รูปเบาะ 1",
  vanSeatRear: "รถตู้: รูปเบาะ 2",
  odometer: "รถตู้: รูปเลขไมล์",
  temporaryReceipt: "รายละเอียดการชำระเงิน/ใบเสร็จชั่วคราว",
  bookingTransferSlip: "ใบสลิปโอนจอง",
  additionalSlip1: "ใบสลิปเพิ่มเติม 1",
  additionalSlip2: "ใบสลิปเพิ่มเติม 2",
  additionalSlip3: "ใบสลิปเพิ่มเติม 3",
  additionalSlip4: "ใบสลิปเพิ่มเติม 4",
  additionalSlip5: "ใบสลิปเพิ่มเติม 5",
  additionalSlip6: "ใบสลิปเพิ่มเติม 6"
};

const bookingAttachmentLabels: Record<BookingAttachment["category"], string> = {
  bookingSlip: "รูปใบจอง",
  bookingCondition: "รูปเงื่อนไขการจอง",
  carPhoto: "รูปรถจากรายงานจอง",
  idCard: "รูปบัตรประชาชน",
  companyCertificate: "รูปหนังสือรับรองบริษัท"
};

const blankForm: SalesReportInput = {
  bookingReportId: "",
  customerName: "",
  phone: "",
  idCard: "",
  address: "",
  bookingPrice: "",
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  salePrice: "",
  centralDiscount: "",
  finalPrice: "",
  paymentType: "",
  source: "",
  ownership: "",
  project: "",
  carPrice: "",
  bookingDeduction: "",
  transferFee: "",
  netPayment: "",
  downPayment: "",
  insuranceFee: "",
  paymentDetail: "",
  saleConditions: "",
  saleName: "ฐากร",
  teamName: "",
  branch: "",
  deliveryDate: "",
  reportText: "",
  status: "draft"
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function numericOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function fromBooking(report: BookingReport): SalesReportInput {
  return {
    ...blankForm,
    bookingReportId: report.id,
    customerName: report.customerName,
    phone: report.phone,
    idCard: report.idCard,
    address: report.address,
    bookingPrice: report.bookingPrice,
    plate: report.plate,
    brand: report.brand,
    model: report.model,
    year: normalizeCarYear(report.year),
    color: report.color,
    salePrice: report.salePrice,
    finalPrice: report.finalPrice,
    carPrice: report.finalPrice,
    bookingDeduction: report.bookingPrice,
    paymentType: report.paymentType,
    source: report.source,
    ownership: report.ownership,
    project: report.project,
    saleConditions: report.conditions,
    saleName: report.saleName,
    teamName: report.teamName
  };
}

export default function SalesReportsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookingReport[]>([]);
  const [form, setForm] = useState<SalesReportInput>(blankForm);
  const [selectedBooking, setSelectedBooking] = useState<BookingReport | null>(null);
  const [vehiclePhotoMode, setVehiclePhotoMode] = useState<VehiclePhotoMode>("standard");
  const [showMoreSlips, setShowMoreSlips] = useState(false);
  const [salesFiles, setSalesFiles] = useState<Partial<Record<SalesAttachmentCategory, LocalAttachment[]>>>({});
  const salesFilesRef = useRef(salesFiles);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reportText = useMemo(() => renderSalesReport({ ...form, reportText: "" }), [form]);
  const paymentMode = form.paymentType.includes("สด")
    ? "cash"
    : form.paymentType.includes("ไฟแนนซ์") || form.paymentType.toLowerCase().includes("finance")
      ? "finance"
      : "other";

  useEffect(() => {
    salesFilesRef.current = salesFiles;
  }, [salesFiles]);

  useEffect(() => {
    return () => {
      Object.values(salesFilesRef.current).flat().forEach((file) => {
        if (file) URL.revokeObjectURL(file.url);
      });
    };
  }, []);

  function update(field: keyof SalesReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectBooking(report: BookingReport) {
    setSelectedBooking(report);
    setForm(fromBooking(report));
  }

  function addSalesFiles(category: SalesAttachmentCategory, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextFiles = files.map((file) => ({
      id: `${category}-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file)
    }));

    setSalesFiles((current) => ({
      ...current,
      [category]: [...(current[category] || []), ...nextFiles]
    }));
    event.target.value = "";
  }

  function removeSalesFile(category: SalesAttachmentCategory, id: string) {
    setSalesFiles((current) => {
      const remaining = (current[category] || []).filter((file) => {
        if (file.id === id) URL.revokeObjectURL(file.url);
        return file.id !== id;
      });
      return { ...current, [category]: remaining };
    });
  }

  async function searchReports(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ reports: BookingReport[] }>(`/api/booking-reports/search?q=${encodeURIComponent(query)}`);
      setResults(data.reports);
      if (!data.reports.length) setMessage("ไม่พบรายงานจองที่ตรงกับคำค้น");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/api/sales-reports", {
        method: "POST",
        body: JSON.stringify({ ...form, paymentDetail: buildSalesPaymentDetail(form), reportText })
      });
      setMessage("บันทึก Draft รายงานขายลง Google Sheets แล้ว");
    } catch (err) {
      window.localStorage.setItem("bigcar-sales-draft-fallback", JSON.stringify({ ...form, paymentDetail: buildSalesPaymentDetail(form), reportText }));
      setError(err instanceof Error ? `${err.message} - บันทึกสำรองในเครื่องแล้ว` : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setMessage("คัดลอกรายงานขายแล้ว");
      setError("");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้ว copy เอง");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">รายงานขาย</h1>
          <p className="mt-1 text-sm text-soft">ค้นรายงานจองเดิม แล้วสร้างรายงานขายแบบ Draft / Preview</p>
        </div>
        <Link href="/booking-reports" className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white">
          <ArrowLeft size={18} className="text-brand" />
          รายงานจอง
        </Link>
      </header>

      {(message || error) && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-amber-400/40 bg-amber-950/30 text-amber-100" : "border-brand/40 bg-green-950/30 text-green-100"}`}>
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{error || message}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <form onSubmit={searchReports} className="space-y-3">
              <Field label="ค้นรายงานจอง" value={query} onChange={setQuery} placeholder="ทะเบียน / ชื่อลูกค้า / เบอร์โทร" />
              <button type="submit" disabled={searching} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink">
                {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                ค้นหา
              </button>
            </form>
            {results.length > 0 && (
              <div className="mt-3 space-y-2">
                {results.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => selectBooking(report)}
                    className="w-full rounded-lg border border-line bg-[#0b0d11] p-3 text-left hover:border-brand/60"
                  >
                    <p className="font-bold text-white">{report.customerName || "-"}</p>
                    <p className="mt-1 text-sm text-soft">{report.plate} / {report.model} / {report.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={saveDraft} className="space-y-4">
            <Panel title="ข้อมูลลูกค้าและรถ">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ชื่อลูกค้า" value={form.customerName} onChange={(value) => update("customerName", value)} required />
                <Field label="โทร" value={form.phone} onChange={(value) => update("phone", value)} />
                <Field label="เลขบัตรประชาชน" value={form.idCard} onChange={(value) => update("idCard", value)} />
                <Field label="ทะเบียนรถ" value={form.plate} onChange={(value) => update("plate", value)} required />
                <Field label="ยี่ห้อรถยนต์" value={form.brand} onChange={(value) => update("brand", value)} />
                <Field label="รุ่น" value={form.model} onChange={(value) => update("model", value)} />
                <Field label="ปีรถ" value={form.year} onChange={(value) => update("year", value)} />
                <Field label="สี" value={form.color} onChange={(value) => update("color", value)} />
              </div>
              <TextArea label="ที่อยู่จัดส่งเอกสาร" value={form.address} onChange={(value) => update("address", value)} rows={3} />
            </Panel>

            <Panel title="ข้อมูลขาย">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="จองรถยนต์" value={form.bookingPrice} onChange={(value) => update("bookingPrice", numericOnly(value))} />
                <Field label="ราคาที่ตั้งขาย" value={form.salePrice} onChange={(value) => update("salePrice", numericOnly(value))} />
                <Field label="ส่วนลดส่วนกลาง" value={form.centralDiscount} onChange={(value) => update("centralDiscount", numericOnly(value))} />
                <Field label="ราคาที่ขาย" value={form.finalPrice} onChange={(value) => update("finalPrice", numericOnly(value))} required />
                <Field label="การชำระเงิน" value={form.paymentType} onChange={(value) => update("paymentType", value)} />
                <Field label="วันรับรถ" value={form.deliveryDate} onChange={(value) => update("deliveryDate", value)} placeholder="เช่น 18/05/2026" />
                <Field label="แหล่งที่มา" value={form.source} onChange={(value) => update("source", value)} />
                <Field label="กรรมสิทธิ์" value={form.ownership} onChange={(value) => update("ownership", value)} />
                <Field label="Project" value={form.project} onChange={(value) => update("project", value)} />
                <Field label="สาขา" value={form.branch} onChange={(value) => update("branch", value)} />
                <Field label="Sale" value={form.saleName} onChange={(value) => update("saleName", value)} required />
                <Field label="ทีม" value={form.teamName} onChange={(value) => update("teamName", value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update("paymentType", "ซื้อสด")}
                  className={`min-h-11 rounded-lg border px-3 font-semibold ${paymentMode === "cash" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
                >
                  ซื้อสด
                </button>
                <button
                  type="button"
                  onClick={() => update("paymentType", "ไฟแนนซ์")}
                  className={`min-h-11 rounded-lg border px-3 font-semibold ${paymentMode === "finance" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
                >
                  ไฟแนนซ์
                </button>
              </div>
              {paymentMode === "cash" && (
                <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                  <p className="mb-3 text-sm font-bold text-white">รายละเอียดการชำระเงิน: ซื้อสด</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ราคารถ" value={form.carPrice} onChange={(value) => update("carPrice", numericOnly(value))} />
                    <Field label="หักเงินจอง" value={form.bookingDeduction} onChange={(value) => update("bookingDeduction", numericOnly(value))} />
                    <Field label="ค่าโอน" value={form.transferFee} onChange={(value) => update("transferFee", numericOnly(value))} />
                    <Field label="จ่ายสุทธิ" value={form.netPayment} onChange={(value) => update("netPayment", numericOnly(value))} />
                  </div>
                </div>
              )}
              {paymentMode === "finance" && (
                <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                  <p className="mb-3 text-sm font-bold text-white">รายละเอียดการชำระเงิน: ไฟแนนซ์</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="เงินดาวน์" value={form.downPayment} onChange={(value) => update("downPayment", numericOnly(value))} />
                    <Field label="ค่าเบี้ยประกันรถ" value={form.insuranceFee} onChange={(value) => update("insuranceFee", numericOnly(value))} />
                    <Field label="หักเงินจอง" value={form.bookingDeduction} onChange={(value) => update("bookingDeduction", numericOnly(value))} />
                    <Field label="จ่ายสุทธิ" value={form.netPayment} onChange={(value) => update("netPayment", numericOnly(value))} />
                  </div>
                </div>
              )}
              {paymentMode === "other" && (
                <TextArea label="รายละเอียดการชำระเงิน" value={form.paymentDetail} onChange={(value) => update("paymentDetail", value)} rows={4} />
              )}
              <TextArea label="เงื่อนไขการขาย" value={form.saleConditions} onChange={(value) => update("saleConditions", value)} rows={4} />
            </Panel>

            <Panel title="ไฟล์แนบ Draft รายงานขาย">
              <BookingAttachmentSummary attachments={selectedBooking?.attachments || []} />

              <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">รูปรถใหม่สำหรับรายงานขาย</p>
                    <p className="mt-1 text-xs text-soft">ไม่ใช้รูปรถจากรายงานจอง ให้ถ่าย/เพิ่มรูปใหม่ตามเคสขาย</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVehiclePhotoMode("standard")}
                      className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${vehiclePhotoMode === "standard" ? "border-brand bg-brand text-ink" : "border-line bg-panel text-white"}`}
                    >
                      รถทั่วไป
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehiclePhotoMode("van")}
                      className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${vehiclePhotoMode === "van" ? "border-brand bg-brand text-ink" : "border-line bg-panel text-white"}`}
                    >
                      รถตู้
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(["carFrontLeft", "carFrontRight", "carRearLeft", "carRearRight"] as SalesAttachmentCategory[]).map((category) => (
                    <SalesAttachmentBox
                      key={category}
                      category={category}
                      files={salesFiles[category] || []}
                      onAdd={addSalesFiles}
                      onRemove={removeSalesFile}
                    />
                  ))}
                  {vehiclePhotoMode === "van" && (["vanSeatFront", "vanSeatRear", "odometer"] as SalesAttachmentCategory[]).map((category) => (
                    <SalesAttachmentBox
                      key={category}
                      category={category}
                      files={salesFiles[category] || []}
                      onAdd={addSalesFiles}
                      onRemove={removeSalesFile}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="mb-3">
                  <p className="font-bold text-white">รูปชำระเงิน / ใบเสร็จ / สลิป</p>
                  <p className="mt-1 text-xs text-soft">พื้นฐานแสดง 2 ใบสลิปเพิ่มเติม และกดแสดงเมนูเพิ่มเติมได้</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["temporaryReceipt", "bookingTransferSlip", "additionalSlip1", "additionalSlip2"] as SalesAttachmentCategory[]).map((category) => (
                    <SalesAttachmentBox
                      key={category}
                      category={category}
                      files={salesFiles[category] || []}
                      onAdd={addSalesFiles}
                      onRemove={removeSalesFile}
                    />
                  ))}
                  {showMoreSlips && (["additionalSlip3", "additionalSlip4", "additionalSlip5", "additionalSlip6"] as SalesAttachmentCategory[]).map((category) => (
                    <SalesAttachmentBox
                      key={category}
                      category={category}
                      files={salesFiles[category] || []}
                      onAdd={addSalesFiles}
                      onRemove={removeSalesFile}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreSlips((current) => !current)}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white"
                >
                  <ChevronDown size={17} className={showMoreSlips ? "rotate-180 text-brand" : "text-brand"} />
                  {showMoreSlips ? "ซ่อนสลิปเพิ่มเติม" : "แสดงเมนูเพิ่มเติม"}
                </button>
              </div>

              <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink">
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                บันทึก Draft รายงานขาย
              </button>
            </Panel>
          </form>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Preview รายงานขาย</h2>
                <p className="text-xs text-soft">ข้อความตาม template รายงานขาย</p>
              </div>
              <button type="button" onClick={copyReport} className="flex min-h-10 items-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand">
                <Clipboard size={17} />
                Copy
              </button>
            </div>
            <pre className="max-h-[68vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-7 text-white">
              {reportText}
            </pre>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
        <FileText size={18} className="text-brand" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BookingAttachmentSummary({ attachments }: { attachments: BookingAttachment[] }) {
  const visibleAttachments = attachments.filter((attachment) => attachment.category !== "carPhoto");

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">รูปจากรายงานจองเดิม</p>
          <p className="mt-1 text-xs text-soft">แสดงเฉพาะหมวดเอกสารเดิม ส่วนรูปรถให้เพิ่มใหม่ในรายงานขาย</p>
        </div>
        <span className="rounded-lg border border-line bg-panel px-2 py-1 text-xs font-semibold text-brand">{visibleAttachments.length} ไฟล์</span>
      </div>
      {visibleAttachments.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibleAttachments.map((attachment, index) => (
            <div key={`${attachment.category}-${attachment.name}-${index}`} className="rounded-lg border border-line bg-panel p-3">
              <p className="text-sm font-semibold text-white">{bookingAttachmentLabels[attachment.category]}</p>
              <p className="mt-1 truncate text-xs text-soft">{attachment.name}</p>
              <p className="mt-2 text-xs text-amber-100">เปิดรูปจริงได้หลังเปิดระบบ Google Drive upload</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-soft">ยังไม่มีไฟล์จากรายงานจองที่ดึงมาได้</p>
      )}
    </div>
  );
}

function SalesAttachmentBox({
  category,
  files,
  onAdd,
  onRemove
}: {
  category: SalesAttachmentCategory;
  files: LocalAttachment[];
  onAdd: (category: SalesAttachmentCategory, event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (category: SalesAttachmentCategory, id: string) => void;
}) {
  const addId = `${category}-add`;
  const cameraId = `${category}-camera`;

  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{salesAttachmentLabels[category]}</p>
          <p className="mt-1 text-xs text-soft">{files.length ? `${files.length} ไฟล์` : "ยังไม่ได้เพิ่มรูป"}</p>
        </div>
        <ImagePlus size={18} className="shrink-0 text-brand" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={addId} className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white">
          <ImagePlus size={16} className="text-brand" />
          เพิ่มรูป
        </label>
        <input id={addId} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(event) => onAdd(category, event)} />

        <label htmlFor={cameraId} className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white">
          <Camera size={16} className="text-brand" />
          ถ่าย
        </label>
        <input id={cameraId} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(event) => onAdd(category, event)} />
      </div>

      {files.length > 0 && (
        <div className="mt-3 grid gap-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 rounded-lg border border-line bg-[#0b0d11] p-2">
              {file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-panel">
                  <FileText size={20} className="text-brand" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{file.name}</p>
                <div className="mt-1 flex gap-2">
                  <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                    <Eye size={14} />
                    เปิดดู
                  </a>
                  <button type="button" onClick={() => onRemove(category, file.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-200">
                    <X size={14} />
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-h-24 w-full resize-y rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}
