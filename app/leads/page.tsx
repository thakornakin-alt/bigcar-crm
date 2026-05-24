"use client";

import type { ReactNode } from "react";
import { CalendarDays, Car, Phone, Search, Sparkles, Tag, UserRound } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";

const leadStages = ["ทั้งหมด", "ต้องโทรติดตาม", "นัดดูรถ", "รอรถตรงรุ่น", "จองแล้ว"];

const sampleLeads = [
  {
    name: "ตัวอย่างลูกค้าหารถ",
    phone: "091-xxx-xxxx",
    interest: "Commuter / Van",
    budget: "900,000 - 1,100,000",
    owner: "เซลล์เจ้าของเคส",
    stage: "รอรถตรงรุ่น",
    nextAction: "โทรติดตามวันนี้"
  }
];

const matchHints = ["รุ่นรถ", "ปีรถ", "สี", "งบประมาณ", "ประเภทการซื้อ", "สาขา", "Tag ความสนใจ"];

export default function LeadsPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="ลูกค้าหารถ"
        subtitle="เก็บลูกค้าที่กำลังหารถ รุ่นที่สนใจ งบประมาณ และงานติดตาม"
        actions={
          <TopMenuButton href="/calendar" icon={<CalendarDays size={18} />} variant="primary">
            ปฏิทิน
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="ค้นหาและติดตาม" icon={<Search size={18} />}>
            <SearchField icon={<Search size={18} />} placeholder="ค้นชื่อลูกค้า / เบอร์ / รุ่นที่สนใจ / LINE ID" />
            <div className="flex flex-wrap gap-2">
              {leadStages.map((stage, index) => (
                <FilterChip key={stage} active={index === 0}>
                  {stage}
                </FilterChip>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="เพิ่มลูกค้าหารถ" icon={<UserRound size={18} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              <InputPreview label="ชื่อลูกค้า" value="ชื่อ / บริษัท" icon={<UserRound size={16} />} />
              <InputPreview label="เบอร์โทร" value="091-778-5117" icon={<Phone size={16} />} />
              <InputPreview label="LINE ID" value="@bigcars" icon={<Tag size={16} />} />
              <InputPreview label="รุ่นที่สนใจ" value="รุ่น / กลุ่มรถ" icon={<Car size={16} />} />
              <InputPreview label="งบประมาณ" value="ช่วงราคา" icon={<Sparkles size={16} />} />
              <InputPreview label="ประเภทการซื้อ" value="ซื้อสด / ไฟแนนซ์" icon={<Tag size={16} />} />
            </div>
            <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
              ใช้สำหรับเก็บลูกค้าที่ยังหารถอยู่ และช่วยติดตามงานต่อเนื่อง
            </div>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="รายการลูกค้าที่ต้องตาม" icon={<UserRound size={18} />}>
            {sampleLeads.map((lead) => (
              <div key={lead.name} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{lead.name}</p>
                    <p className="mt-1 text-sm text-soft">{lead.phone} · {lead.interest}</p>
                    <p className="mt-1 text-xs text-soft">งบประมาณ: {lead.budget}</p>
                  </div>
                  <span className="rounded-full border border-brand/40 px-2.5 py-1 text-xs font-black text-brand">{lead.stage}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InfoLine label="เจ้าของเคส" value={lead.owner} />
                  <InfoLine label="งานถัดไป" value={lead.nextAction} />
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Smart Stock Matching" icon={<Sparkles size={18} />}>
            <p className="text-sm leading-6 text-soft">
              ระบบจะช่วยแนะนำรถเข้าใหม่ที่ตรงกับลูกค้าเท่านั้น เซลล์ยังเป็นคนตัดสินใจเองทุกครั้ง
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {matchHints.map((hint) => (
                <div key={hint} className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
                  {hint}
                </div>
              ))}
            </div>
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function InputPreview({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-bold text-soft">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-3 py-2">
      <p className="text-xs text-soft">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
