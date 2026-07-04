"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, ScanLine } from "lucide-react";
import { BottomSheet, NativeButton } from "@/app/components/ui";
import type { VehicleDeliveryOcrFields, VehicleDeliveryOcrResult } from "@/lib/documents-v2/vehicle-delivery-ocr";

type Props = {
  imageDataUrl: string;
  onApply: (fields: Partial<Pick<VehicleDeliveryOcrFields, "customer_name" | "customer_id_no" | "customer_address_1" | "customer_address_2" | "customer_postal_code">>) => void;
};

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

function parseDataUrl(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  return {
    mimeType: match?.[1] || "",
    base64: match?.[2] || ""
  };
}

export function VehicleDeliveryOcrScanner({ imageDataUrl, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<VehicleDeliveryOcrResult | null>(null);

  const reviewValues = useMemo(() => (preview ? preview.fields : null), [preview]);
  const normalizedImageDataUrl = String(imageDataUrl || "").trim();
  const hasImage = normalizedImageDataUrl.length > 0;
  const canScan = hasImage;

  async function scanImage() {
    if (!normalizedImageDataUrl) {
      setError("กรุณาถ่ายหรือแนบรูปบัตรประชาชนก่อนสแกน");
      return;
    }

    const payload = parseDataUrl(normalizedImageDataUrl);
    if (!payload.base64 || !payload.mimeType.startsWith("image/")) {
      setError("รูปบัตรประชาชนไม่พร้อมสำหรับ OCR");
      return;
    }

    setReading(true);
    setError("");
    setPreview(null);
    setStatus("กำลังสแกนข้อมูลจากบัตรประชาชน...");

    try {
      const data = await readJson<{ ok: boolean; result: VehicleDeliveryOcrResult }>("/api/documents-v2/vehicle-delivery-ocr", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setPreview(data.result);
      setStatus("สแกนสำเร็จ ตรวจข้อมูลก่อนกดเติมข้อมูลลงฟอร์ม");
    } catch (err) {
      setPreview({
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
    onApply({
      customer_name: reviewValues.customer_name || "",
      customer_id_no: reviewValues.customer_id_no || "",
      customer_address_1: reviewValues.customer_address_1 || "",
      customer_address_2: reviewValues.customer_address_2 || "",
      customer_postal_code: reviewValues.customer_postal_code || ""
    });
    setStatus("เติมข้อมูลลงฟอร์มแล้ว");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
          setStatus("");
          setPreview(null);
        }}
        disabled={!canScan}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ScanLine size={16} />
        สแกนข้อมูลจากบัตรประชาชน
      </button>

      <BottomSheet
        open={open}
        title="สแกนข้อมูลเอกสารส่งมอบรถยนต์"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setPreview(null); setStatus(""); setError(""); }} className="rounded-lg border border-line px-3 py-2 text-sm font-bold text-white">
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
          <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs leading-5 text-soft">
            OCR จะเติมได้เฉพาะชื่อลูกค้า เลขบัตร ที่อยู่ และรหัสไปรษณีย์เท่านั้น ข้อมูลรถ วันที่ ทะเบียน เบอร์โทร และรูปบัตรจะไม่ถูกแก้
          </p>

          {hasImage ? (
            <div className="rounded-lg border border-line bg-[#0b0d11] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={normalizedImageDataUrl} alt="Preview รูปบัตรประชาชนสำหรับ OCR" className="max-h-40 w-full rounded-md object-contain" />
            </div>
          ) : null}

          <button
            type="button"
            onClick={scanImage}
            disabled={!canScan || reading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reading ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
            สแกนข้อมูลจากบัตรประชาชน
          </button>

          <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${hasImage ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-dashed border-line bg-[#0b0d11] text-soft"}`}>
            {hasImage ? "พร้อมสแกนข้อมูลจากบัตรประชาชน" : "กรุณาถ่ายหรือเลือกรูปบัตรก่อนสแกน"}
          </p>

          {status && (
            <p className={`rounded-lg border px-3 py-2 text-xs font-bold leading-5 ${reading ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-[#0b0d11] text-soft"}`}>
              {reading && <Loader2 size={14} className="mr-1 inline animate-spin align-[-2px]" />}
              {status}
            </p>
          )}

          {error && <p className="rounded-lg border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{error}</p>}

          {preview && reviewValues && (
            <div className="space-y-3">
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-3 text-sm text-brand">
                ตรวจข้อมูลก่อนเติมเข้าฟอร์ม
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ReviewRow label="ชื่อ" value={reviewValues.customer_name || "-"} />
                <ReviewRow label="เลขบัตรประชาชน" value={reviewValues.customer_id_no || "-"} />
                <ReviewRow label="ที่อยู่บรรทัด 1" value={reviewValues.customer_address_1 || "-"} wide />
                <ReviewRow label="ที่อยู่บรรทัด 2" value={reviewValues.customer_address_2 || "-"} wide />
                <ReviewRow label="รหัสไปรษณีย์" value={reviewValues.customer_postal_code || "-"} />
              </div>
              <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-xs leading-5 text-soft">
                <p className="mb-1 font-black text-white">ข้อความ OCR</p>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-5">{reviewValues.rawText || "-"}</pre>
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
      <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}
