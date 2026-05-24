"use client";

import type { ReactNode } from "react";
import { CheckCircle2, FileUp, Search, ShieldCheck, UploadCloud } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";

const financeCases = [
  {
    plate: "ตัวอย่าง",
    customerName: "ลูกค้าไฟแนนซ์",
    model: "รอเชื่อมรายงานจอง",
    owner: "เซลล์เจ้าของเคส",
    status: "รอผลไฟแนนซ์"
  }
];

const rules = [
  "แสดงเฉพาะเคสไฟแนนซ์ที่ยังรอผล",
  "ไม่แสดงเคสซื้อสด",
  "ไม่แสดงเคสปิดแล้วหรือส่งมอบแล้ว",
  "เมื่ออนุมัติแล้วจึงส่งเข้า การเตรียมรถ"
];

export default function FinanceApprovalPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="อัปโหลดใบอนุมัติไฟแนนซ์"
        subtitle="ใช้เฉพาะเคสไฟแนนซ์ที่ยังรอผล เมื่ออนุมัติแล้วค่อยส่งรถเข้า การเตรียมรถ"
        actions={
          <TopMenuButton href="/vehicle-prep" icon={<CheckCircle2 size={18} />} variant="primary">
            การเตรียมรถ
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="อัปโหลดใบอนุมัติ" icon={<UploadCloud size={18} />}>
            <div className="rounded-lg border border-dashed border-brand/40 bg-brand/10 px-4 py-6 text-center">
              <FileUp size={28} className="mx-auto text-brand" />
              <p className="mt-3 text-lg font-black text-white">เพิ่มไฟล์ใบอนุมัติ</p>
              <p className="mt-1 text-sm leading-6 text-soft">รองรับ PDF / รูปภาพ / เอกสารไฟแนนซ์ในอนาคต</p>
              <button type="button" className="mt-4 min-h-11 rounded-lg bg-brand px-4 text-sm font-black text-ink">
                เลือกไฟล์
              </button>
            </div>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
              Phase นี้ยังไม่ผูก upload จริง เพื่อไม่กระทบ flow เอกสารและ Drive เดิม
            </p>
          </SectionCard>

          <SectionCard title="กฎการแสดงทะเบียน" icon={<ShieldCheck size={18} />}>
            <div className="grid gap-2">
              {rules.map((rule) => (
                <RuleItem key={rule}>{rule}</RuleItem>
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="เลือกทะเบียนที่เกี่ยวข้อง" icon={<Search size={18} />}>
            <SearchField icon={<Search size={18} />} placeholder="ค้นทะเบียน / ลูกค้า / เซลล์เจ้าของเคส" />
            <div className="flex flex-wrap gap-2">
              <FilterChip active>รอผลไฟแนนซ์</FilterChip>
              <FilterChip>อนุมัติแล้ว</FilterChip>
              <FilterChip>ไม่ผ่านไฟแนนซ์</FilterChip>
            </div>
            {financeCases.map((item) => (
              <div key={item.plate} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{item.plate}</p>
                    <p className="mt-1 text-sm text-soft">{item.model} · {item.customerName}</p>
                    <p className="mt-1 text-xs text-soft">เจ้าของเคส: {item.owner}</p>
                  </div>
                  <span className="rounded-full border border-amber-300/40 px-2.5 py-1 text-xs font-black text-amber-100">{item.status}</span>
                </div>
                <button type="button" className="mt-3 min-h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
                  ติ๊กเลือกทะเบียนนี้
                </button>
              </div>
            ))}
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function RuleItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
      <CheckCircle2 size={16} className="text-brand" />
      {children}
    </div>
  );
}
