"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Camera, CheckCircle2, Loader2, Paperclip, ScanLine } from "lucide-react";
import { BottomSheet, NativeButton } from "@/app/components/ui";
import { documentFileToOcrPayloads, imagePayloadToDataUrl, isPdfFile, mergeOcrRecords } from "@/lib/ocr/client-document-ocr";
import type { BookingReportInput, BuyerType } from "@/lib/types";
import type { BookingReportOcrDocumentType, BookingReportOcrResult } from "@/lib/booking-report-ocr";
import { mapOcrToBookingReportFields } from "@/lib/booking-report-ocr";

type ReviewValues = {
  customerName: string;
  idCard: string;
  phone: string;
  address: string;
};

const documentOptions: Array<{ value: BookingReportOcrDocumentType; label: string; hint: string }> = [
  { value: "id_card", label: "บัตรประชาชน", hint: "ชื่อ, นามสกุล, เลขบัตร, ที่อยู่" },
  { value: "company_certificate", label: "หนังสือรับรองบริษัท", hint: "ชื่อบริษัท, เลขผู้เสียภาษี, ที่อยู่" },
  { value: "business_card", label: "นามบัตร", hint: "ชื่อบริษัท, ผู้ติดต่อ, เบอร์โทร" }
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

function compressName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function mergeIfEmpty(current: BookingReportInput, patch: ReviewValues) {
  return {
    ...current,
    customerName: current.customerName || patch.customerName,
    idCard: current.idCard || patch.idCard,
    phone: current.phone || patch.phone,
    address: current.address || patch.address
  };
}

function buildReviewValues(result: BookingReportOcrResult, buyerType: BuyerType): ReviewValues {
  const mapped = mapOcrToBookingReportFields(result);

  if (buyerType === "company") {
    return {
      customerName: compressName(mapped.customerName || result.fields.companyName || result.fields.name),
      idCard: result.fields.taxId || mapped.idCard,
      phone: result.fields.phone || mapped.phone,
      address: mapped.address || result.fields.companyAddress || result.fields.address
    };
  }

  return {
    customerName: compressName(result.fields.name || mapped.customerName),
    idCard: result.fields.idNumber || mapped.idCard,
    phone: result.fields.phone || mapped.phone,
    address: result.fields.address || mapped.address
  };
}

export function BookingReportOcrScanner({
  buyerType,
  current,
  onApply
}: {
  buyerType: BuyerType;
  current: BookingReportInput;
  onApply: (next: BookingReportInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<BookingReportOcrDocumentType>("id_card");
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [preview, setPreview] = useState<BookingReportOcrResult | null>(null);

  const reviewValues = useMemo(() => (preview ? buildReviewValues(preview, buyerType) : null), [buyerType, preview]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadFile = isPdfFile(file) ? file : file;
    setPreview(null);
    setPreviewUrl("");
    setError("");
    setReading(true);
    setStatus(isPdfFile(file) ? "กำลังแปลง PDF และอ่าน OCR..." : "กำลังอ่านเอกสารจากรูป...");
    event.target.value = "";

    try {
      const ocrPayload = await documentFileToOcrPayloads(uploadFile);
      if (ocrPayload.payloads[0]) setPreviewUrl(imagePayloadToDataUrl(ocrPayload.payloads[0]));
      const results: BookingReportOcrResult[] = [];

      for (const [index, payload] of ocrPayload.payloads.entries()) {
        setStatus(ocrPayload.sourceType === "pdf" ? `กำลัง OCR PDF หน้า ${index + 1}/${ocrPayload.processedPages}` : "กำลังอ่านเอกสารจากรูป...");
        const data = await readJson<{ result: BookingReportOcrResult }>("/api/booking-report/ocr", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            documentType
          })
        });
        results.push(data.result);
      }

      const merged = mergeOcrRecords(results.map((item) => item.fields)) as BookingReportOcrResult["fields"];
      const result: BookingReportOcrResult = {
        documentType,
        fields: {
          ...merged,
          rawText: results.map((item) => item.rawText || item.fields.rawText).filter(Boolean).join("\n\n")
        },
        rawText: results.map((item) => item.rawText || item.fields.rawText).filter(Boolean).join("\n\n")
      };
      setPreview(result);
      setStatus(ocrPayload.sourceType === "pdf" ? `อ่าน OCR PDF สำเร็จ ${ocrPayload.processedPages}/${ocrPayload.pageCount} หน้า` : "อ่าน OCR สำเร็จ ตรวจข้อมูลก่อนกดยืนยัน");
    } catch (err) {
      setPreview({
        documentType,
        fields: {
          name: "",
          firstName: "",
          lastName: "",
          idNumber: "",
          address: "",
          companyName: "",
          taxId: "",
          contactName: "",
          phone: "",
          companyAddress: "",
          rawText: ""
        },
        rawText: ""
      });
      setStatus("OCR อ่านไม่สำเร็จ สามารถกรอก/แก้ไข Preview เองแล้วกดยืนยันได้");
      setError(err instanceof Error ? err.message : "OCR อ่านเอกสารไม่สำเร็จ");
    } finally {
      setReading(false);
    }
  }

  function clearPreview() {
    setPreview(null);
    setPreviewUrl("");
    setStatus("");
    setError("");
    setReading(false);
  }

  function applyPreview() {
    if (!reviewValues) return;
    onApply(mergeIfEmpty(current, reviewValues));
    setStatus("ยืนยันแล้ว");
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-3 text-sm font-black text-ink transition hover:border-brand/80"
        >
          <ScanLine size={18} />
          สแกนบัตร/เอกสาร
        </button>
      </div>

      <BottomSheet
        open={open}
        title="สแกนบัตร/เอกสาร"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={clearPreview} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-white">
              ล้าง
            </button>
            <NativeButton type="button" disabled={!preview || reading} onClick={applyPreview}>
              {reading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              เติมข้อมูลลงฟอร์ม
            </NativeButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {documentOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setDocumentType(item.value)}
                className={`rounded-lg border px-3 py-3 text-left text-sm font-bold transition ${
                  documentType === item.value ? "border-brand bg-brand/10 text-brand" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                <span className="block">{item.label}</span>
                <span className="mt-1 block text-xs font-medium text-soft">{item.hint}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink">
              <Camera size={18} />
              ถ่ายรูป
              <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="sr-only" />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-bold text-white">
              <Paperclip size={18} className="text-brand" />
              เพิ่มไฟล์
              <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="sr-only" />
            </label>
          </div>

          <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs leading-5 text-soft">
            รองรับบัตรประชาชน หนังสือรับรองบริษัท และนามบัตร ต้องตรวจข้อมูลก่อนกดยืนยัน ไม่มีการบันทึกอัตโนมัติ
          </p>

          {status && (
            <p className={`rounded-lg border px-3 py-2 text-xs font-bold leading-5 ${reading ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-[#0b0d11] text-soft"}`}>
              {reading && <Loader2 size={14} className="mr-1 inline animate-spin align-[-2px]" />}
              {status}
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{error}</p>
          )}

          {previewUrl && (
            <div className="rounded-lg border border-line bg-[#0b0d11] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="OCR document preview" className="max-h-32 w-full rounded-md object-contain" />
            </div>
          )}

          {preview && reviewValues && (
            <div className="space-y-3">
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-3 text-sm text-brand">
                ตรวจข้อมูลก่อนเติมเข้าฟอร์ม
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <ReviewRow label="ชื่อผู้ซื้อ" value={reviewValues.customerName || "-"} />
                <ReviewRow label="เลขบัตร/เลขภาษี" value={reviewValues.idCard || "-"} />
                <ReviewRow label="เบอร์โทร" value={reviewValues.phone || "-"} />
                <ReviewRow label="ที่อยู่" value={reviewValues.address || "-"} wide />
              </div>

              <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-xs leading-5 text-soft">
                <p className="mb-1 font-black text-white">ข้อมูลที่ OCR อ่านได้</p>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-5">{JSON.stringify(preview, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function ReviewRow({
  label,
  value,
  wide = false
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-line bg-[#0b0d11] px-3 py-2 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-bold text-soft">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
