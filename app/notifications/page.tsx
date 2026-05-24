"use client";

import { Bell, CalendarDays, Car, CheckCircle2, FileText, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";

const notifications = [
  {
    title: "รถกลับวันนี้",
    plate: "ตัวอย่าง",
    customerName: "ลูกค้าจองจริง",
    owner: "เซลล์เจ้าของเคส",
    detail: "กดเพื่อเปิดหน้าการเตรียมรถ",
    href: "/vehicle-prep",
    icon: Wrench,
    tone: "brand"
  },
  {
    title: "รอใบอนุมัติไฟแนนซ์",
    plate: "ตัวอย่างไฟแนนซ์",
    customerName: "ลูกค้าไฟแนนซ์",
    owner: "เซลล์เจ้าของเคส",
    detail: "ยังไม่ส่งเข้าเตรียมรถจนกว่าอนุมัติ",
    href: "/finance-approval",
    icon: FileText,
    tone: "amber"
  },
  {
    title: "พบรถเข้าใหม่ที่ตรงกับลูกค้าหารถ",
    plate: "หลายคัน",
    customerName: "ลูกค้าหารถ",
    owner: "ระบบแนะนำ",
    detail: "แนะนำเท่านั้น ไม่ Auto จองหรือทักลูกค้า",
    href: "/stock-matches",
    icon: Car,
    tone: "cyan"
  }
];

export default function NotificationsPage() {
  return (
    <PageContainer wide>
      <PageTitle
        title="แจ้งเตือน"
        subtitle="รวมเฉพาะงานสำคัญที่ทำให้งานเดินต่อ ไม่แจ้งเตือนรก และกดแล้วไปหน้าที่เกี่ยวข้องทันที"
        actions={
          <TopMenuButton href="/" icon={<Bell size={18} />} variant="primary">
            Dashboard
          </TopMenuButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ตัวกรอง" icon={<Bell size={18} />}>
          <div className="flex flex-wrap gap-2">
            <FilterChip active>ทั้งหมด</FilterChip>
            <FilterChip>งานวันนี้</FilterChip>
            <FilterChip>ไฟแนนซ์</FilterChip>
            <FilterChip>เตรียมรถ</FilterChip>
            <FilterChip>Stock Match</FilterChip>
          </div>
          <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
            Badge/Notification จะหายเองเมื่อข้อมูลครบในอนาคต ผู้ใช้ไม่ต้องมากดปิดเอง
          </div>
        </SectionCard>

        <SectionCard title="งานสำคัญ" icon={<CalendarDays size={18} />}>
          <div className="grid gap-3">
            {notifications.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.title} href={item.href} className="block rounded-lg border border-line bg-[#0b0d11] p-3 transition hover:border-brand/60">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-white">{item.title}</p>
                        <span className="rounded-full border border-brand/30 px-2.5 py-1 text-xs font-black text-brand">สำคัญ</span>
                      </div>
                      <p className="mt-1 text-sm text-soft">
                        {item.plate} · {item.customerName} · {item.owner}
                      </p>
                      <p className="mt-1 text-xs text-soft">{item.detail}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
          <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-3 text-sm leading-6 text-brand">
            Version 3 แยกแจ้งเตือนหน้าบ้าน/หลังบ้านชัดเจน และไม่บังคับทุกเคสผ่านแย่งคิวรถ
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
