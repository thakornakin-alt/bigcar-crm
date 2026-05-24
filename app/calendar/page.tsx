"use client";

import { CalendarDays, Car, Clock3, Phone, Tag, Wrench } from "lucide-react";
import { PageContainer, PageTitle, SectionCard } from "@/app/components/ui";

const taskTypes = [
  { label: "ส่งมอบรถ", className: "bg-emerald-300", text: "text-emerald-100", border: "border-emerald-300/35" },
  { label: "นัดลูกค้า", className: "bg-sky-300", text: "text-sky-100", border: "border-sky-300/35" },
  { label: "Follow-up", className: "bg-amber-300", text: "text-amber-100", border: "border-amber-300/35" },
  { label: "งานด่วน", className: "bg-red-300", text: "text-red-100", border: "border-red-300/35" },
  { label: "งานหลังบ้าน", className: "bg-zinc-300", text: "text-zinc-100", border: "border-zinc-300/35" }
];

const todayTasks = [
  {
    time: "09:30",
    title: "โทรติดตามลูกค้า",
    detail: "Commuter / งบ 1.1M",
    type: "Follow-up",
    icon: Phone
  },
  {
    time: "11:00",
    title: "นัดดูรถ บางนา",
    detail: "1นค 2797 · VAN",
    type: "นัดลูกค้า",
    icon: Car
  },
  {
    time: "14:00",
    title: "เช็กงานเตรียมรถ",
    detail: "รอวันรถกลับจากอู่",
    type: "งานหลังบ้าน",
    icon: Wrench
  },
  {
    time: "16:30",
    title: "ส่งมอบรถ",
    detail: "ตรวจเอกสารและปิดเคส",
    type: "ส่งมอบรถ",
    icon: CalendarDays
  }
];

function typeStyle(type: string) {
  return taskTypes.find((item) => item.label === type) || taskTypes[0];
}

export default function CalendarPage() {
  return (
    <PageContainer wide>
      <PageTitle title="ปฏิทิน" subtitle="งานวันนี้ของทีม" />

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ประเภทงาน" icon={<Tag size={18} />}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {taskTypes.map((type) => (
              <div key={type.label} className={`flex min-h-12 items-center gap-3 rounded-lg border ${type.border} bg-[#0b0d11] px-3`}>
                <span className={`h-2.5 w-2.5 rounded-full ${type.className}`} />
                <span className={`text-sm font-black ${type.text}`}>{type.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="งานวันนี้" icon={<CalendarDays size={18} />}>
          <div className="space-y-2">
            {todayTasks.map((task) => {
              const Icon = task.icon;
              const style = typeStyle(task.type);
              return (
                <div key={`${task.time}-${task.title}`} className={`rounded-xl border ${style.border} bg-[#0b0d11] p-3`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-brand">
                      <Icon size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-white">{task.time}</span>
                        <span className={`rounded-full border ${style.border} px-2 py-0.5 text-xs font-black ${style.text}`}>
                          {task.type}
                        </span>
                      </div>
                      <p className="mt-1 text-base font-black text-white">{task.title}</p>
                      <p className="mt-1 text-sm text-soft">{task.detail}</p>
                    </div>
                    <Clock3 size={17} className="mt-1 shrink-0 text-soft" />
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
