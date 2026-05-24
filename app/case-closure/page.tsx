"use client";

import type { ReactNode } from "react";
import { Archive, CalendarDays, Car, CheckCircle2, FileText, Search, ShieldCheck } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";

const activeCases = [
  {
    plate: "ตัวอย่าง",
    model: "รอเชื่อมรายงานขาย",
    customerName: "ลูกค้าส่งมอบแล้ว",
    owner: "เซลล์เจ้าของเคส",
    deliveredAt: "รอเลือกวันที่",
    status: "พร้อมปิดเคส"
  }
];

const closeEffects = [
  "ไม่ขึ้นในงาน Active",
  "ไม่แจ้งเตือนซ้ำ",
  "ไม่ขึ้นในอัปโหลดไฟแนนซ์",
  "เก็บไว้ในรายงานย้อนหลัง",
  "นำไปสรุป Dashboard / คอมมิชชั่น"
];

export default function CaseClosurePage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="ปิดเคส / ส่งมอบแล้ว"
        subtitle="ใช้หลังส่งมอบรถแล้ว เพื่อเก็บเคสเข้าประวัติและหยุดแจ้งเตือนงาน Active"
        actions={
          <TopMenuButton href="/sales-reports" icon={<FileText size={18} />} variant="primary">
            รายงานขาย
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="ค้นหาเคสส่งมอบ" icon={<Search size={18} />}>
            <SearchField icon={<Search size={18} />} placeholder="ค้นทะเบียน / ลูกค้า / เซลล์เจ้าของเคส" />
            <div className="flex flex-wrap gap-2">
              <FilterChip active>พร้อมปิดเคส</FilterChip>
              <FilterChip>รอส่งมอบ</FilterChip>
              <FilterChip>ปิดแล้ว</FilterChip>
            </div>
            <div className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-3 text-sm leading-6 text-amber-100">
              ปิดเคสควรทำหลังส่งมอบแล้วเท่านั้น เพื่อป้องกันเคสหายจากงาน Active เร็วเกินจริง
            </div>
          </SectionCard>

          <SectionCard title="ผลหลังปิดเคส" icon={<ShieldCheck size={18} />}>
            <div className="grid gap-2">
              {closeEffects.map((item) => (
                <EffectItem key={item}>{item}</EffectItem>
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="รายการที่พร้อมปิดเคส" icon={<Archive size={18} />}>
            {activeCases.map((item) => (
              <div key={item.plate} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{item.plate}</p>
                    <p className="mt-1 text-sm text-soft">{item.model} · {item.customerName}</p>
                    <p className="mt-1 text-xs text-soft">เจ้าของเคส: {item.owner}</p>
                  </div>
                  <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-black text-brand">
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InfoBox icon={<CalendarDays size={16} />} label="วันที่ส่งมอบ" value={item.deliveredAt} />
                  <InfoBox icon={<Car size={16} />} label="สถานะเคส" value="รอปิดเคสจริง" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" className="min-h-10 rounded-lg bg-brand px-3 text-sm font-black text-ink">
                    ปิดเคส
                  </button>
                  <button type="button" className="min-h-10 rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
                    เปิดรายงานขาย
                  </button>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
              Phase นี้เป็น UI shell ยังไม่เปลี่ยนสถานะจริงใน Google Sheet เพื่อไม่กระทบระบบเดิม
            </div>
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function EffectItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
      <CheckCircle2 size={16} className="text-brand" />
      {children}
    </div>
  );
}

function InfoBox({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-bold text-soft">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
