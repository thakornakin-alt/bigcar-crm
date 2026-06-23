"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Camera, CheckCircle2, Loader2, Paperclip, ScanLine } from "lucide-react";
import { BottomSheet, NativeButton } from "@/app/components/ui";
import { documentFileToOcrPayloads, imagePayloadToDataUrl, isPdfFile } from "@/lib/ocr/client-document-ocr";
import type { PowerOfAttorneyOcrDocumentType, PowerOfAttorneyOcrResult } from "@/lib/documents-v2/power-of-attorney-ocr";
import { splitPowerOfAttorneyAddress, type PowerOfAttorneySuggestion } from "@/lib/documents-v2/power-of-attorney";

type Props = {
  reportAddress: string;
  currentName: string;
  onApply: (suggestion: PowerOfAttorneySuggestion) => void;
};

const documentOptions: Array<{ value: PowerOfAttorneyOcrDocumentType; label: string; hint: string }> = [
  { value: "id_card", label: "บัตรประชาชน", hint: "ชื่อและที่อยู่" },
  { value: "company_certificate", label: "หนังสือรับรองบริษัท", hint: "ชื่อบริษัทและที่อยู่" }
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
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function mergeResults(results: PowerOfAttorneyOcrResult[]) {
  const merged = results.reduce<PowerOfAttorneySuggestion & { rawText: string }>(
    (acc, item) => ({
      ...acc,
      ...item.fields,
      rawText: [acc.rawText, item.rawText || item.fields.rawText].filter(Boolean).join("\n\n")
    }),
    { rawText: "" }
  );
  return merged;
}

export function PowerOfAttorneyOcrScanner({ reportAddress, currentName, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<PowerOfAttorneyOcrDocumentType>("id_card");
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [preview, setPreview] = useState<PowerOfAttorneyOcrResult | null>(null);

  const reviewValues = useMemo(() => (preview ? preview.fields : null), [preview]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview(null);
    setPreviewUrl("");
    setError("");
    setReading(true);
    setStatus(isPdfFile(file) ? "กำลังแปลง PDF และสแกน..." : "กำลังสแกน...");
    event.target.value = "";

    try {
      const ocrPayload = await documentFileToOcrPayloads(file);
      if (ocrPayload.payloads[0]) setPreviewUrl(imagePayloadToDataUrl(ocrPayload.payloads[0]));

      const results: PowerOfAttorneyOcrResult[] = [];
      for (const [index, payload] of ocrPayload.payloads.entries()) {
        setStatus(ocrPayload.sourceType === "pdf" ? `กำลัง OCR หน้า ${index + 1}/${ocrPayload.processedPages}` : "กำลังสแกน...");
        const data = await readJson<{ ok: boolean; result: PowerOfAttorneyOcrResult }>("/api/documents-v2/power-of-attorney-ocr", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            documentType
          })
        });
        results.push(data.result);
      }

      const merged = mergeResults(results);
      setPreview({
        documentType,
        provider: results.some((item) => item.provider === "free-ocr") ? "free-ocr" : "fallback",
        fields: merged,
        rawText: merged.rawText
      });
      setStatus(ocrPayload.sourceType === "pdf" ? `สแกนสำเร็จ ${ocrPayload.processedPages}/${ocrPayload.pageCount} หน้า` : "สแกนสำเร็จ ตรวจข้อมูลก่อนกดเติมข้อมูลลงฟอร์ม");
    } catch (err) {
      setPreview({
        documentType,
        provider: "fallback",
        fields: { rawText: "" },
        rawText: ""
      });
      setStatus("สแกนไม่สำเร็จ กรุณาตรวจหรือกรอกข้อมูลเองก่อนอัปเดตเอกสาร");
      setError(err instanceof Error ? err.message : "สแกนไม่สำเร็จ");
    } finally {
      setReading(false);
    }
  }

  function applyPreview() {
    if (!reviewValues) return;
    const addressSuggestion = splitPowerOfAttorneyAddress(reviewValues.address || "");
    const name = reviewValues.customerName || currentName || "";
    const age = reviewValues.customer_age || "";
    const race = reviewValues.customer_race || "";
    const nationality = reviewValues.customer_nationality || "";
    onApply({
      customerName: name,
      customerAge: age,
      customerRace: race,
      customerNationality: nationality,
      customer_age: age,
      customer_race: race,
      customer_nationality: nationality,
      customerHouseNo: addressSuggestion.customer_house_no,
      customerMoo: addressSuggestion.customer_moo,
      customerSoi: addressSuggestion.customer_soi,
      customerRoad: addressSuggestion.customer_road,
      customerSubdistrict: addressSuggestion.cusyomer_subdistrict,
      customerDistrict: addressSuggestion.customer_district,
      customerProvince: addressSuggestion.customer_province,
      address: reviewValues.address || "",
      ...addressSuggestion
    });
    setStatus("เติมข้อมูลลงฟอร์มแล้ว");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm font-semibold text-white"
      >
        <ScanLine size={16} />
        สแกนข้อมูลสำหรับหนังสือมอบอำนาจ
      </button>

      <BottomSheet
        open={open}
        title="สแกนข้อมูลสำหรับหนังสือมอบอำนาจ"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setPreview(null); setPreviewUrl(""); setStatus(""); setError(""); }} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-white">
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
          <div className="grid gap-2 sm:grid-cols-2">
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
            ระบบช่วยเติมข้อมูลเบื้องต้น กรุณาตรวจสอบก่อนอัปเดตเอกสาร
          </p>

          {status && (
            <p className={`rounded-lg border px-3 py-2 text-xs font-bold leading-5 ${reading ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-[#0b0d11] text-soft"}`}>
              {reading && <Loader2 size={14} className="mr-1 inline animate-spin align-[-2px]" />}
              {status}
            </p>
          )}

          {error && <p className="rounded-lg border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{error}</p>}

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
                <ReviewRow label="ชื่อ" value={reviewValues.customerName || currentName || "-"} />
                <ReviewRow label="อายุ" value={reviewValues.customer_age || "-"} />
                <ReviewRow label="เชื้อชาติ" value={reviewValues.customer_race || "-"} />
                <ReviewRow label="สัญชาติ" value={reviewValues.customer_nationality || "-"} />
                <ReviewRow label="บ้านเลขที่" value={reviewValues.customer_house_no || "-"} />
                <ReviewRow label="หมู่ที่" value={reviewValues.customer_moo || "-"} />
                <ReviewRow label="ซอย" value={reviewValues.customer_soi || "-"} />
                <ReviewRow label="ถนน" value={reviewValues.customer_road || "-"} />
                <ReviewRow label="ตำบล/แขวง" value={reviewValues.cusyomer_subdistrict || "-"} />
                <ReviewRow label="อำเภอ/เขต" value={reviewValues.customer_district || "-"} />
                <ReviewRow label="จังหวัด" value={reviewValues.customer_province || "-"} />
                <ReviewRow label="ที่อยู่ OCR" value={reviewValues.address || "-"} wide />
              </div>
              <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-xs leading-5 text-soft">
                <p className="mb-1 font-black text-white">ข้อความ OCR</p>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-5">{JSON.stringify(preview, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function ReviewRow({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-line bg-[#0b0d11] px-3 py-2 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-bold text-soft">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
