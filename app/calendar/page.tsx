"use client";

import { CalendarDays, Car, Clock3, Plus, UserRound, Wrench } from "lucide-react";
import { PageContainer, PageTitle, SectionCard } from "@/app/components/ui";

const taskTypes = [
  { label: "นัดส่งมอบ", className: "bg-emerald-300", text: "text-emerald-100", border: "border-emerald-300/35" },
  { label: "รถกลับอู่", className: "bg-amber-300", text: "text-amber-100", border: "border-amber-300/35" },
  { label: "นัดลูกค้า", className: "bg-red-300", text: "text-red-100", border: "border-red-300/35" },
  { label: "อื่นๆ", className: "bg-zinc-200", text: "text-zinc-100", border: "border-zinc-300/35" }
];

const todayTasks = [
  { time: "09:30", title: "ติดตามลูกค้า", detail: "ลูกค้ามุ่งหวัง / นัดดูรถ", type: "นัดลูกค้า", icon: UserRound },
  { time: "11:00", title: "รถกลับอู่", detail: "เลือกทะเบียนเพื่อผูกกับงานรถ", type: "รถกลับอู่", icon: Wrench },
  { time: "15:00", title: "นัดส่งมอบ", detail: "ตรวจเอกสารและปิดเคส", type: "นัดส่งมอบ", icon: Car },
  { time: "17:00", title: "งานทั่วไป", detail: "งานด่วน / งานหลังบ้าน / อื่นๆ", type: "อื่นๆ", icon: CalendarDays }
];

function typeStyle(type: string) {
  return taskTypes.find((item) => item.label === type) || taskTypes[3];
}

export default function CalendarPage() {
  return (
    <PageContainer wide>
      <PageTitle title="ปฏิทิน" subtitle="ปฏิทินเดียวสำหรับงานลูกค้า งานรถ และงานเซลล์" />

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="สร้างงาน" icon={<Plus size={18} />}>
          <div className="grid gap-2">
            <CalendarInput label="ประเภทงาน" value="นัดส่งมอบ / รถกลับอู่ / นัดลูกค้า / อื่นๆ" />
            <CalendarInput label="ทะเบียน" value="ใช้กับงานรถ เช่น รถกลับอู่ / นัดรับรถ / นัดส่งมอบ" />
            <CalendarInput label="รายละเอียด" value="ชื่อลูกค้า เวลา สาขา หรือหมายเหตุ" />
          </div>
          <button type="button" className="min-h-11 rounded-lg bg-brand px-4 text-sm font-black text-ink">
            เพิ่มงาน
          </button>
        </SectionCard>

        <SectionCard title="งานวันนี้" icon={<CalendarDays size={18} />}>
          <div className="mb-3 flex flex-wrap gap-2">
            {taskTypes.map((type) => (
              <span key={type.label} className={`inline-flex min-h-8 items-center gap-2 rounded-full border ${type.border} px-3 text-xs font-black ${type.text}`}>
                <span className={`h-2 w-2 rounded-full ${type.className}`} />
                {type.label}
              </span>
            ))}
          </div>
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

function CalendarInput({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">
      <p className="text-xs font-bold text-soft">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
