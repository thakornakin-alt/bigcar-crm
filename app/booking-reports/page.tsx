"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clipboard,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Save,
  Search,
  Upload
} from "lucide-react";
import { buildDefaultBookingSubject, renderBookingReport } from "@/lib/booking-report";
import type { BookingAttachment, BookingAttachmentCategory, BookingReportInput, BuyerType, CustomerLookup, StockVehicle } from "@/lib/types";

const saleEmails: Record<string, string> = {
  "ฐากร": "thakornakin@gmail.com",
  "กันตา": "kanta.deepal@gmail.com"
};

const blankForm: BookingReportInput = {
  customerName: "",
  idCard: "",
  phone: "",
  address: "",
  buyerType: "individual",
  bookingPrice: "",
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  salePrice: "",
  finalPrice: "",
  finalPriceNote: "",
  discount: "",
  paymentType: "",
  source: "",
  ownership: "",
  project: "",
  campaign: "",
  saleName: "ฐากร",
  teamName: "",
  conditions: "",
  emailSubject: "",
  emailTo: "",
  emailCc: "",
  emailBcc: "",
  attachments: [],
  reportText: "",
  status: "draft"
};

const attachmentLabels: Array<{ key: BookingAttachmentCategory; label: string; hint: string }> = [
  { key: "bookingSlip", label: "รูปใบจอง", hint: "JPG, PNG, PDF" },
  { key: "bookingCondition", label: "รูปเงื่อนไขการจอง", hint: "JPG, PNG, PDF" },
  { key: "carPhoto", label: "รูปรถ", hint: "ใช้กล้องหลังได้" },
  { key: "idCard", label: "รูปบัตรประชาชน", hint: "OCR รอบนี้เป็น Preview" },
  { key: "companyCertificate", label: "รูปหนังสือรับรองบริษัท", hint: "จำเป็นเมื่อผู้ซื้อเป็นบริษัท" }
];

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function numericOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function fillIfEmpty(current: BookingReportInput, vehicle: StockVehicle): BookingReportInput {
  return {
    ...current,
    brand: current.brand || vehicle.brand,
    model: current.model || vehicle.model,
    year: current.year || vehicle.year,
    color: current.color || vehicle.color,
    salePrice: current.salePrice || numericOnly(vehicle.salePrice),
    source: current.source || vehicle.source,
    ownership: current.ownership || vehicle.ownership,
    project: current.project || vehicle.project,
    campaign: current.campaign || vehicle.campaign
  };
}

export default function BookingReportsPage() {
  const [form, setForm] = useState<BookingReportInput>(blankForm);
  const [attachmentFiles, setAttachmentFiles] = useState<Record<BookingAttachmentCategory, File[]>>({
    bookingSlip: [],
    bookingCondition: [],
    carPhoto: [],
    idCard: [],
    companyCertificate: []
  });
  const [lookupStatus, setLookupStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reportText = useMemo(() => renderBookingReport({ ...form, reportText: "" }), [form]);
  const senderEmail = saleEmails[form.saleName] || "";
  const companyWarning = form.buyerType === "company" && attachmentFiles.companyCertificate.length === 0;

  useEffect(() => {
    const latest = window.localStorage.getItem("bigcar-booking-email");
    if (latest) {
      try {
        const parsed = JSON.parse(latest) as Pick<BookingReportInput, "emailTo" | "emailCc" | "emailBcc">;
        setForm((current) => ({ ...current, ...parsed }));
      } catch {
        window.localStorage.removeItem("bigcar-booking-email");
      }
    }
  }, []);

  useEffect(() => {
    setForm((current) => {
      if (current.emailSubject.trim()) return current;
      return {
        ...current,
        emailSubject: buildDefaultBookingSubject(current)
      };
    });
  }, [form.customerName, form.model, form.plate]);

  useEffect(() => {
    const plate = form.plate.trim();
    if (plate.length < 3) return;

    const timeout = window.setTimeout(async () => {
      setLookupStatus("กำลังค้นหาสต๊อกจากทะเบียน...");
      try {
        const data = await readJson<{ vehicle: StockVehicle | null; warning?: string }>(
          `/api/stock/lookup?plate=${encodeURIComponent(plate)}`
        );

        if (data.vehicle) {
          setForm((current) => fillIfEmpty(current, data.vehicle as StockVehicle));
          setLookupStatus("พบข้อมูลสต๊อกและเติมช่องที่ว่างแล้ว");
        } else {
          setLookupStatus(data.warning ? "ยังค้นสต๊อกไม่ได้ แต่กรอกต่อได้" : "ไม่พบทะเบียนนี้ในสต๊อกล่าสุด");
        }
      } catch {
        setLookupStatus("ค้นสต๊อกไม่สำเร็จ แต่ฟอร์มยังใช้งานได้");
      }
    }, 550);

    return () => window.clearTimeout(timeout);
  }, [form.plate]);

  useEffect(() => {
    const idCard = form.idCard.trim();
    if (idCard.length < 8) return;

    const timeout = window.setTimeout(async () => {
      try {
        const data = await readJson<{ customer: CustomerLookup }>(
          `/api/customers/lookup?idCard=${encodeURIComponent(idCard)}`
        );

        if (data.customer) {
          setForm((current) => ({
            ...current,
            customerName: current.customerName || data.customer?.customerName || "",
            phone: current.phone || data.customer?.phone || "",
            address: current.address || data.customer?.address || ""
          }));
        }
      } catch {
        // Lookup is optional in phase 1.
      }
    }, 550);

    return () => window.clearTimeout(timeout);
  }, [form.idCard]);

  function update(field: keyof BookingReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateMoney(field: keyof BookingReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: numericOnly(value) }));
  }

  function updateBuyerType(value: BuyerType) {
    setForm((current) => ({ ...current, buyerType: value }));
  }

  function handleFiles(category: BookingAttachmentCategory, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    setAttachmentFiles((current) => ({
      ...current,
      [category]: [...current[category], ...files]
    }));
    event.target.value = "";
  }

  function removeFile(category: BookingAttachmentCategory, index: number) {
    setAttachmentFiles((current) => ({
      ...current,
      [category]: current[category].filter((_, fileIndex) => fileIndex !== index)
    }));
  }

  function buildAttachments(): BookingAttachment[] {
    return attachmentLabels.flatMap(({ key }) =>
      attachmentFiles[key].map((file) => ({
        category: key,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size
      }))
    );
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload: BookingReportInput = {
      ...form,
      attachments: buildAttachments(),
      reportText,
      status: "draft"
    };

    window.localStorage.setItem(
      "bigcar-booking-email",
      JSON.stringify({
        emailTo: payload.emailTo,
        emailCc: payload.emailCc,
        emailBcc: payload.emailBcc
      })
    );

    try {
      await readJson("/api/booking-reports", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMessage("บันทึก Draft ลง Google Sheets แล้ว ยังไม่มีการส่ง Email/LINE จริง");
    } catch (err) {
      window.localStorage.setItem("bigcar-booking-draft-fallback", JSON.stringify(payload));
      setError(
        err instanceof Error
          ? `${err.message} - บันทึก draft สำรองในเครื่องนี้แล้ว`
          : "บันทึก Google Sheets ไม่สำเร็จ - บันทึก draft สำรองในเครื่องนี้แล้ว"
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyReport() {
    setCopying(true);
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(reportText);
      setMessage("คัดลอก Preview รายงานแล้ว");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความใน Preview แล้ว copy เอง");
    } finally {
      window.setTimeout(() => setCopying(false), 500);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">รายงานจอง</h1>
          <p className="mt-1 text-sm text-soft">Staging / Draft / Preview เท่านั้น ยังไม่ส่ง Email หรือ LINE จริง</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/stock-import"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <Upload size={18} className="text-brand" aria-hidden="true" />
            Stock
          </Link>
          <Link
            href="/sales-reports"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <FileText size={18} className="text-brand" aria-hidden="true" />
            ขาย
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <ArrowLeft size={18} className="text-brand" aria-hidden="true" />
            ลูกค้า
          </Link>
        </div>
      </header>

      {(message || error || companyWarning) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error || companyWarning
              ? "border-amber-400/40 bg-amber-950/30 text-amber-100"
              : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          {error || companyWarning ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} />}
          <span>{error || (companyWarning ? "ผู้ซื้อเป็นบริษัท: ควรแนบหนังสือรับรองบริษัทก่อนส่งจริง" : message)}</span>
        </div>
      )}

      <form onSubmit={saveDraft} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="space-y-4">
          <Panel title="ข้อมูลลูกค้า" icon={<ClipboardList size={18} />}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateBuyerType("individual")}
                className={`min-h-11 rounded-lg border px-3 font-semibold ${
                  form.buyerType === "individual" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                บุคคลธรรมดา
              </button>
              <button
                type="button"
                onClick={() => updateBuyerType("company")}
                className={`min-h-11 rounded-lg border px-3 font-semibold ${
                  form.buyerType === "company" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                บริษัท
              </button>
            </div>
            <Field label="ชื่อผู้ซื้อ" value={form.customerName} onChange={(value) => update("customerName", value)} required />
            <Field label="เลขบัตรประชาชน" value={form.idCard} onChange={(value) => update("idCard", value)} inputMode="numeric" />
            <Field label="เบอร์โทร" value={form.phone} onChange={(value) => update("phone", value)} inputMode="tel" />
            <TextArea label="ที่อยู่จัดส่งเอกสาร" value={form.address} onChange={(value) => update("address", value)} rows={3} />
          </Panel>

          <Panel title="ข้อมูลรถ" icon={<Search size={18} />}>
            <Field label="ทะเบียนรถ" value={form.plate} onChange={(value) => update("plate", value)} required />
            {lookupStatus && <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs text-soft">{lookupStatus}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ยี่ห้อรถยนต์" value={form.brand} onChange={(value) => update("brand", value)} />
              <Field label="รุ่น" value={form.model} onChange={(value) => update("model", value)} />
              <Field label="ปีรถ" value={form.year} onChange={(value) => update("year", value)} inputMode="numeric" />
              <Field label="สี" value={form.color} onChange={(value) => update("color", value)} />
            </div>
          </Panel>

          <Panel title="ข้อมูลราคา" icon={<FileText size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="จองรถยนต์" value={form.bookingPrice} onChange={(value) => updateMoney("bookingPrice", value)} inputMode="numeric" />
              <Field label="ราคาที่ตั้งขาย" value={form.salePrice} onChange={(value) => updateMoney("salePrice", value)} inputMode="numeric" />
              <Field label="ราคาที่ขาย" value={form.finalPrice} onChange={(value) => updateMoney("finalPrice", value)} inputMode="numeric" />
              <Field label="ส่วนลด" value={form.discount} onChange={(value) => updateMoney("discount", value)} inputMode="numeric" />
            </div>
            <Field label="หมายเหตุราคาที่ขาย" value={form.finalPriceNote} onChange={(value) => update("finalPriceNote", value)} placeholder="เช่น ส่วนลด 4,000" />
            <Field label="การชำระเงิน" value={form.paymentType} onChange={(value) => update("paymentType", value)} placeholder="เงินสด / ไฟแนนซ์" />
          </Panel>

          <Panel title="การตลาดและ Sale" icon={<Mail size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="แหล่งที่มา" value={form.source} onChange={(value) => update("source", value)} />
              <Field label="กรรมสิทธิ์" value={form.ownership} onChange={(value) => update("ownership", value)} />
              <Field label="Project" value={form.project} onChange={(value) => update("project", value)} />
              <Field label="Campaign" value={form.campaign} onChange={(value) => update("campaign", value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Sale" value={form.saleName} onChange={(value) => update("saleName", value)} options={["ฐากร", "กันตา"]} />
              <Field label="ทีม" value={form.teamName} onChange={(value) => update("teamName", value)} placeholder="เช่น พี่ลีฟ" />
            </div>
            <TextArea label="เงื่อนไข" value={form.conditions} onChange={(value) => update("conditions", value)} rows={5} />
          </Panel>

          <Panel title="Email Staging" icon={<Mail size={18} />}>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs text-soft">
              ผู้ส่งตาม Sale: {senderEmail || "ยังไม่พบ mapping"} - เฟสนี้เป็น Preview เท่านั้น
            </p>
            <Field label="หัวข้ออีเมล" value={form.emailSubject} onChange={(value) => update("emailSubject", value)} />
            <Field label="To" value={form.emailTo} onChange={(value) => update("emailTo", value)} placeholder="email1@example.com, email2@example.com" />
            <Field label="CC" value={form.emailCc} onChange={(value) => update("emailCc", value)} />
            <Field label="BCC" value={form.emailBcc} onChange={(value) => update("emailBcc", value)} />
          </Panel>

          <Panel title="ไฟล์แนบ Draft" icon={<Paperclip size={18} />}>
            <div className="space-y-3">
              {attachmentLabels.map((item) => (
                <AttachmentBox
                  key={item.key}
                  item={item}
                  files={attachmentFiles[item.key]}
                  onChange={(event) => handleFiles(item.key, event)}
                  onRemove={(index) => removeFile(item.key, index)}
                />
              ))}
            </div>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Preview รายงาน</h2>
                <p className="text-xs text-soft">ข้อความคงรูปแบบตาม template</p>
              </div>
              <button
                type="button"
                onClick={copyReport}
                disabled={copying}
                className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand transition hover:border-brand"
              >
                {copying ? <Loader2 size={17} className="animate-spin" /> : <Clipboard size={17} />}
                Copy
              </button>
            </div>
            <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-7 text-white">
              {reportText}
            </pre>
            <button
              type="submit"
              disabled={saving}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-base font-bold text-ink"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              บันทึก Draft
            </button>
            <p className="mt-3 text-xs leading-5 text-soft">
              ปุ่มนี้ยังไม่ส่ง Email หรือ LINE จริง ระบบจะบันทึกข้อมูลรายงานและ metadata ไฟล์แนบไว้เพื่อทดสอบก่อนขึ้น production
            </p>
          </section>
        </aside>
      </form>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
        <span className="text-brand">{icon}</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "numeric";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="min-h-24 w-full resize-y rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function AttachmentBox({
  item,
  files,
  onChange,
  onRemove
}: {
  item: { key: BookingAttachmentCategory; label: string; hint: string };
  files: File[];
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}) {
  const canUseCamera = item.key === "carPhoto" || item.key === "idCard" || item.key === "bookingSlip";

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{item.label}</p>
          <p className="mt-1 text-xs text-soft">{item.hint}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand">
            เพิ่มรูป
            <input type="file" multiple accept="image/*,.pdf" onChange={onChange} className="sr-only" />
          </label>
          {canUseCamera && (
            <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-white">
              <Camera size={17} />
              ถ่าย
              <input type="file" multiple accept="image/*" capture="environment" onChange={onChange} className="sr-only" />
            </label>
          )}
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#141821] px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-[#dce2eb]">{file.name}</span>
              <button type="button" onClick={() => onRemove(index)} className="shrink-0 text-amber-200">
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
