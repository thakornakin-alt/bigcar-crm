"use client";

import { CalendarDays, Camera, FileSignature, PhoneCall, UserRound } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";

const frontOfficeTasks = [
  { time: "09:30", title: "โทรติดตามลูกค้า", detail: "ลูกค้าหารถ / รุ่นที่สนใจ", icon: PhoneCall },
  { time: "11:00", title: "นัดดูรถ", detail: "เปิดจากเคสลูกค้า", icon: UserRound },
  { time: "14:00", title: "ถ่ายรูปส่งลูกค้า", detail: "งานหน้าบ้านเท่านั้น", icon: Camera },
  { time: "16:00", title: "นัดเซ็นเอกสาร", detail: "เชื่อมรายงานจองในอนาคต", icon: FileSignature }
];

export default function FrontOfficeCalendarPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="ปฏิทินงานหน้าบ้าน"
        subtitle="ใช้สำหรับงานลูกค้า นัดหมาย และ Follow-up เท่านั้น แยกจากงานเตรียมรถหลังบ้าน"
        actions={
          <TopMenuButton href="/leads" icon={<UserRound size={18} />} variant="primary">
            ลูกค้าหารถ
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="มุมมองงาน" icon={<CalendarDays size={18} />}>
          <div className="flex flex-wrap gap-2">
            <FilterChip active>วันนี้</FilterChip>
            <FilterChip>สัปดาห์นี้</FilterChip>
            <FilterChip>นัดลูกค้า</FilterChip>
            <FilterChip>Follow-up</FilterChip>
          </div>
          <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
            งานในหน้านี้จะเชื่อม Dashboard &gt; งานวันนี้ และ Notification Bell เฉพาะเรื่องลูกค้า
          </div>
        </SectionCard>

        <SectionCard title="งานหน้าบ้านวันนี้" icon={<CalendarDays size={18} />}>
          <div className="grid gap-3">
            {frontOfficeTasks.map((task) => {
              const Icon = task.icon;
              return (
                <div key={`${task.time}-${task.title}`} className="flex gap-3 rounded-lg border border-line bg-[#0b0d11] p-3">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-sm font-black text-brand">
                    {task.time}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-black text-white">
                      <Icon size={16} className="text-brand" />
                      {task.title}
                    </p>
                    <p className="mt-1 text-sm text-soft">{task.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
