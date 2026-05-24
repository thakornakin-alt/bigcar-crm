"use client";

import { CalendarDays, Car, Hammer, RotateCcw, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";

const backOfficeTasks = [
  { date: "วันนี้", title: "รถไปอู่", detail: "งานเคลม / ลอกลาย", icon: Hammer },
  { date: "วันนี้", title: "รถกลับ", detail: "แจ้งเตือนเมื่อถึงกำหนด", icon: RotateCcw },
  { date: "พรุ่งนี้", title: "นัดรับรถ", detail: "หลังข้อมูลเตรียมรถครบ", icon: Car },
  { date: "สัปดาห์นี้", title: "งานเตรียมรถค้าง", detail: "ดูจาก checklist", icon: Wrench }
];

export default function BackOfficeCalendarPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="ปฏิทินงานหลังบ้าน"
        subtitle="ใช้สำหรับงานเตรียมรถ งานอู่ เคลม ลอกลาย รถกลับ และนัดรับรถ ไม่ปนกับงานลูกค้า"
        actions={
          <TopMenuButton href="/vehicle-prep" icon={<Wrench size={18} />} variant="primary">
            รอส่งมอบ
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ตัวกรองหลังบ้าน" icon={<CalendarDays size={18} />}>
          <div className="flex flex-wrap gap-2">
            <FilterChip active>ทั้งหมด</FilterChip>
            <FilterChip>วันรถไปอู่</FilterChip>
            <FilterChip>วันรถกลับ</FilterChip>
            <FilterChip>นัดรับรถ</FilterChip>
            <FilterChip>งานค้าง</FilterChip>
          </div>
          <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
            หน้านี้เตรียมเชื่อมกับ รอส่งมอบ, Dashboard งานวันนี้ และ Notification Bell
          </div>
        </SectionCard>

        <SectionCard title="งานหลังบ้าน" icon={<Wrench size={18} />}>
          <div className="grid gap-3">
            {backOfficeTasks.map((task) => {
              const Icon = task.icon;
              return (
                <div key={`${task.date}-${task.title}`} className="flex gap-3 rounded-lg border border-line bg-[#0b0d11] p-3">
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-sm font-black text-brand">
                    {task.date}
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
