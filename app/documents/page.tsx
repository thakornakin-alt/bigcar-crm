"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Camera, Download, FileImage, FileSpreadsheet, FileText, Loader2, RotateCcw, Search, Upload } from "lucide-react";
import { PageContainer, PageTitle, SearchField, SectionCard } from "@/app/components/ui";

type ScanMode = "person" | "company";

const documentItems = [
  { title: "แบบฟอร์มจอง", type: "PDF", updatedAt: "พร้อมต่อยอด", icon: FileText },
  { title: "ตารางผ่อน", type: "Export", updatedAt: "จาก Calculator", icon: FileSpreadsheet },
  { title: "รูปสต๊อก", type: "PNG", updatedAt: "จาก Stock Export", icon: FileImage },
  { title: "เอกสารสัญญา", type: "Future", updatedAt: "เตรียมรองรับ", icon: FileText }
];

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ScanMode>("person");
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const filteredDocs = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documentItems;
    return documentItems.filter((item) => [item.title, item.type, item.updatedAt].join(" ").toLowerCase().includes(term));
  }, [query]);

  function handleCardImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setConfirmed(false);
    setScanning(true);
    const url = URL.createObjectURL(file);
    window.setTimeout(() => {
      setPreviewUrl(url);
      setScanning(false);
    }, 450);
  }

  const previewRows =
    mode === "person"
      ? [
          ["ชื่อ", "รอตรวจ OCR"],
          ["นามสกุล", "รอตรวจ OCR"],
          ["เลขบัตรประชาชน", "รอตรวจ OCR"],
          ["วันเกิด", "รอตรวจ OCR"],
          ["ที่อยู่", "รอตรวจ OCR"]
        ]
      : [
          ["ชื่อบริษัท", "รอตรวจ OCR"],
          ["เลขผู้เสียภาษี", "รอตรวจ OCR"],
          ["ที่อยู่บริษัท", "รอตรวจ OCR"]
        ];

  return (
    <PageContainer wide>
      <PageTitle
        title="เอกสาร"
        subtitle="ศูนย์รวมเอกสาร ดาวน์โหลด เปิดไฟล์ และเตรียม OCR บัตรแบบ Preview ก่อนบันทึก"
      />

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <SectionCard title="ค้นหาเอกสาร" icon={<Search size={18} />}>
            <SearchField
              icon={<Search size={18} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นชื่อเอกสาร / PDF / Excel / รูปภาพ"
            />
          </SectionCard>

          <SectionCard title="รายการเอกสาร" icon={<FileText size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredDocs.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                      <Icon size={20} />
                    </div>
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-soft">{item.type} · {item.updatedAt}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-sm font-bold text-white">
                        เปิดไฟล์
                      </button>
                      <button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink">
                        <Download size={16} />
                        ดาวน์โหลด
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="OCR Smart ID Card" icon={<Camera size={18} />}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("person")}
                className={`min-h-11 rounded-lg border px-3 text-sm font-black ${mode === "person" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                บุคคลธรรมดา
              </button>
              <button
                type="button"
                onClick={() => setMode("company")}
                className={`min-h-11 rounded-lg border px-3 text-sm font-black ${mode === "company" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                บริษัท
              </button>
            </div>

            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-brand/50 bg-[#0b0d11] px-4 py-5 text-center">
              <Camera size={28} className="text-brand" />
              <span className="font-black text-white">ถ่ายบัตร</span>
              <span className="text-sm text-soft">เปิดกล้องมือถือหรือเลือกรูป แล้วตรวจ Preview ก่อนบันทึก</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleCardImage} className="sr-only" />
            </label>

            {scanning && (
              <div className="flex min-h-20 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
                <Loader2 size={18} className="mr-2 animate-spin text-brand" />
                กำลังเตรียม Preview
              </div>
            )}

            {previewUrl && !scanning && (
              <div className="space-y-3 rounded-lg border border-line bg-[#0b0d11] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="ภาพบัตรสำหรับ OCR Preview" className="max-h-56 w-full rounded-lg object-contain" />
                <div className="grid gap-2">
                  {previewRows.map(([label, value]) => (
                    <label key={label} className="rounded-lg border border-line bg-panel px-3 py-2">
                      <span className="text-xs font-bold text-soft">{label}</span>
                      <input defaultValue={value} className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none" />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl("");
                      setConfirmed(false);
                    }}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 font-bold text-white"
                  >
                    <RotateCcw size={18} />
                    สแกนใหม่
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmed(true)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 font-black text-ink"
                  >
                    <Upload size={18} />
                    ยืนยัน
                  </button>
                </div>
              </div>
            )}

            <p className={`rounded-lg border px-3 py-3 text-sm ${confirmed ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-[#0b0d11] text-soft"}`}>
              {confirmed
                ? "ยืนยัน Preview แล้ว: พร้อมต่อยอด Save เข้าระบบใน Phase ถัดไป"
                : "ระบบนี้ไม่ Auto Save ทันที ต้อง Preview และกดยืนยันก่อนเสมอ"}
            </p>
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}
