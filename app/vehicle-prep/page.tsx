"use client";

import type { ReactNode } from "react";
import { CalendarDays, Car, CheckCircle2, FileImage, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard } from "@/app/components/ui";

const prepItems = [
  {
    plate: "ตัวอย่าง",
    model: "รอเชื่อมรายงานจอง",
    customerName: "ลูกค้าจองจริง",
    owner: "เซลล์เจ้าของเคส",
    paymentType: "ซื้อสด / ไฟแนนซ์อนุมัติแล้ว",
    financeStatus: "พร้อมเตรียมรถ",
    badges: ["ขาดรูปลอกลาย", "รอวันรถกลับ", "ยังไม่ได้นัดรับรถ"]
  }
];

const checklist = ["รูปใบเคลม", "รูปลอกลาย", "วันสั่งงาน", "วันรถไปอู่", "วันรถกลับ", "นัดรับรถ", "คาดการณ์วันรถกลับ", "เงื่อนไขการขาย"];

export default function VehiclePrepPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="การเตรียมรถ"
        subtitle="ศูนย์กลางงานเตรียมส่งมอบ แสดงเฉพาะซื้อสดที่จองแล้ว หรือไฟแนนซ์ที่อนุมัติแล้ว"
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="สถานะเตรียมรถ" icon={<Wrench size={18} />}>
          <div className="flex flex-wrap gap-2">
            <FilterChip active>ต้องเตรียมรถ</FilterChip>
            <FilterChip>รอวันรถกลับ</FilterChip>
            <FilterChip>รอนัดรับรถ</FilterChip>
            <FilterChip>ส่งมอบแล้ว</FilterChip>
          </div>
          <div className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-3 text-sm leading-6 text-amber-100">
            รถไฟแนนซ์ที่ยังรอผลจะไม่ขึ้นในหน้านี้ เพื่อไม่บังคับเตรียมรถเร็วเกินจริง
          </div>
          {prepItems.map((item) => (
            <div key={item.plate} className="rounded-lg border border-line bg-[#0b0d11] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-white">{item.plate}</p>
                  <p className="mt-1 text-sm text-soft">{item.model} · {item.customerName}</p>
                  <p className="mt-1 text-xs text-soft">เจ้าของเคส: {item.owner}</p>
                </div>
                <span className="rounded-full border border-brand/40 px-2.5 py-1 text-xs font-black text-brand">{item.financeStatus}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.badges.map((badge) => (
                  <span key={badge} className="rounded-full border border-amber-300/35 px-2.5 py-1 text-xs font-bold text-amber-100">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Checklist งานเตรียมรถ" icon={<CheckCircle2 size={18} />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <div key={item} className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-bold text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                  <CheckCircle2 size={15} />
                </span>
                {item}
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <InfoTile icon={<CalendarDays size={18} />} label="ปฏิทินหลังบ้าน" value="เชื่อมงานอู่/รถกลับ" />
            <InfoTile icon={<FileImage size={18} />} label="รูปงานเคลม" value="เตรียมรองรับอัปโหลด" />
            <InfoTile icon={<Car size={18} />} label="ปิดเคส" value="หลังส่งมอบแล้ว" />
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">
      <div className="mb-2 text-brand">{icon}</div>
      <p className="text-sm font-black text-white">{label}</p>
      <p className="mt-1 text-xs text-soft">{value}</p>
    </div>
  );
}
