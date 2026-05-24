"use client";

import { Car, CheckCircle2, Search, Sparkles, Tag, UserRound, XCircle } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";

const matchCards = [
  {
    lead: "ตัวอย่างลูกค้ามุ่งหวัง",
    interest: "VAN / Commuter",
    vehicle: "TOYOTA COMMUTER 2.8 AT",
    plate: "ตัวอย่าง",
    score: "ตรงรุ่น + งบประมาณ",
    owner: "เซลล์เจ้าของเคส"
  },
  {
    lead: "ลูกค้ารอรถกระบะ",
    interest: "PICK-UP CAB",
    vehicle: "HILUX REVO",
    plate: "รถเข้าใหม่",
    score: "ตรงกลุ่มรถ + สาขา",
    owner: "ระบบแนะนำ"
  }
];

const matchingSignals = ["รุ่นรถ", "ปีรถ", "สี", "งบประมาณ", "ประเภทการซื้อ", "สาขา", "Tag ความสนใจ", "ประวัติติดตามล่าสุด"];

export default function StockMatchesPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="Smart Stock Matching"
        subtitle="ช่วยจับคู่ลูกค้ามุ่งหวังกับรถเข้าใหม่แบบแนะนำเท่านั้น เซลล์เป็นคนตัดสินใจเอง"
        actions={
          <TopMenuButton href="/leads" icon={<UserRound size={18} />} variant="primary">
            ลูกค้ามุ่งหวัง
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-4">
          <SectionCard title="ค้นหา Match" icon={<Search size={18} />}>
            <SearchField icon={<Search size={18} />} placeholder="ค้นลูกค้า / ทะเบียน / รุ่นรถ / สาขา" />
            <div className="flex flex-wrap gap-2">
              <FilterChip active>ทั้งหมด</FilterChip>
              <FilterChip>รถเข้าใหม่</FilterChip>
              <FilterChip>ตรงงบ</FilterChip>
              <FilterChip>ตรงสาขา</FilterChip>
            </div>
          </SectionCard>

          <SectionCard title="กฎความปลอดภัย" icon={<CheckCircle2 size={18} />}>
            <SafetyRule ok label="แนะนำรถให้เซลล์ดู" />
            <SafetyRule ok label="แสดงเหตุผลที่จับคู่" />
            <SafetyRule danger label="ไม่ Auto จองรถ" />
            <SafetyRule danger label="ไม่ Auto ทักลูกค้า" />
            <SafetyRule danger label="ไม่ Auto เปลี่ยนสถานะ" />
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="รายการแนะนำ" icon={<Sparkles size={18} />}>
            {matchCards.map((item) => (
              <div key={`${item.lead}-${item.vehicle}`} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{item.lead}</p>
                    <p className="mt-1 text-sm text-soft">สนใจ: {item.interest}</p>
                  </div>
                  <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-black text-brand">
                    {item.score}
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-line bg-black/20 px-3 py-3">
                  <p className="flex items-center gap-2 font-black text-white">
                    <Car size={16} className="text-brand" />
                    {item.vehicle}
                  </p>
                  <p className="mt-1 text-sm text-soft">ทะเบียน: {item.plate} · เจ้าของเคส: {item.owner}</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" className="min-h-10 rounded-lg bg-brand px-3 text-sm font-black text-ink">
                    เปิดข้อมูลรถ
                  </button>
                  <button type="button" className="min-h-10 rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
                    เปิดลูกค้า
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="ข้อมูลที่ใช้จับคู่" icon={<Tag size={18} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {matchingSignals.map((signal) => (
                <div key={signal} className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
                  {signal}
                </div>
              ))}
            </div>
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function SafetyRule({ label, ok, danger }: { label: string; ok?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
      {ok && <CheckCircle2 size={16} className="text-brand" />}
      {danger && <XCircle size={16} className="text-amber-200" />}
      {label}
    </div>
  );
}
