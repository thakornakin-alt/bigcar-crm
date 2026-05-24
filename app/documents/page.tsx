"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileImage, FileSpreadsheet, FileText, Search, Upload } from "lucide-react";
import { PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";

const documentItems = [
  { title: "แบบฟอร์มจอง", type: "PDF", updatedAt: "พร้อมต่อยอด", href: "/booking-reports", icon: FileText },
  { title: "ใบอนุมัติไฟแนนซ์", type: "Upload", updatedAt: "แยกตาม Version 3", href: "/finance-approval", icon: Upload },
  { title: "ตารางผ่อน", type: "Export", updatedAt: "จาก Calculator", href: "/calculator", icon: FileSpreadsheet },
  { title: "รูปสต๊อก", type: "PNG", updatedAt: "จาก Stock Export", href: "/stock-export", icon: FileImage },
  { title: "เอกสารสัญญา", type: "Future", updatedAt: "เตรียมรองรับ", href: "/documents", icon: FileText }
];

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"latest" | "name">("latest");

  const filteredDocs = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? documentItems.filter((item) => [item.title, item.type, item.updatedAt].join(" ").toLowerCase().includes(term))
      : documentItems;
    return [...filtered].sort((a, b) => sortMode === "name" ? a.title.localeCompare(b.title, "th") : 0);
  }, [query, sortMode]);

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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSortMode("latest")}
                className={`min-h-10 rounded-lg border px-3 text-sm font-black ${sortMode === "latest" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                ล่าสุด
              </button>
              <button
                type="button"
                onClick={() => setSortMode("name")}
                className={`min-h-10 rounded-lg border px-3 text-sm font-black ${sortMode === "name" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                ชื่อเอกสาร
              </button>
            </div>
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
                      <Link href={item.href} className="flex min-h-10 items-center justify-center rounded-lg border border-line px-3 text-sm font-bold text-white">
                        เปิดไฟล์
                      </Link>
                      <button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink disabled:opacity-60" disabled={item.type === "Future"}>
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
          <SectionCard title="อัปโหลดเอกสาร" icon={<Upload size={18} />}>
            <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-5 text-sm leading-6 text-soft">
              หน้านี้ใช้รวมเอกสารและไฟล์กลาง ส่วน OCR Smart Document ถูกย้ายไปอยู่ใน “รายงานจอง” ตาม Version 3 เพื่อให้เชื่อมกับข้อมูลลูกค้าจองจริงโดยตรง
            </div>
            <TopMenuButton href="/booking-reports" icon={<FileText size={18} />} variant="primary">
              ไป OCR ในรายงานจอง
            </TopMenuButton>
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}
