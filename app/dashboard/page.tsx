"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Check, ClipboardCheck, FileText, Plus, User } from "lucide-react";
import { FloatingActionButton, NativeAppHeader, NativeAppShell, NativeBottomNav } from "@/app/components/ui";
import { useSalesProfile } from "@/lib/use-sales-profile";

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

type DashboardMetrics = {
  leads: number;
  newLeadsToday: number;
  bookings: number;
  financeWaiting: number;
  waitingDelivery: number;
  delivered: number;
  todayEvents: number;
};

const blankMetrics: DashboardMetrics = {
  leads: 0,
  newLeadsToday: 0,
  bookings: 0,
  financeWaiting: 0,
  waitingDelivery: 0,
  delivered: 0,
  todayEvents: 0
};

export default function DashboardPage() {
  const { user: salesProfile } = useSalesProfile();
  const [metrics, setMetrics] = useState<DashboardMetrics>(blankMetrics);

  useEffect(() => {
    api<{ metrics: DashboardMetrics }>("/api/dashboard/metrics")
      .then((data) => setMetrics(data.metrics || blankMetrics))
      .catch(() => setMetrics(blankMetrics));
  }, []);

  const dashboard = useMemo(() => formatDashboardMetrics(metrics), [metrics]);

  return (
    <NativeAppShell>
      <NativeAppHeader
        title="BIG CAR CRM"
        subtitle={
          <span>
            {salesProfile
              ? salesProfile.role === "sales" || salesProfile.role === "viewer"
                ? `มุมทำงานของ ${salesProfile.nickname}`
                : `Login เป็น ${salesProfile.nickname}`
              : "BIG CAR RDD CRM"}
          </span>
        }
      />

      <section className="mb-4 grid auto-rows-[124px] grid-cols-2 gap-3">
        <BentoCard href="/leads" label="ลูกค้ามุ่งหวัง" value={dashboard.leads} hint={`ใหม่วันนี้ ${dashboard.newLeadsToday}`} icon={<User size={18} />} />
        <BentoCard href="/booking-reports" label="ยอดจอง" value={dashboard.bookings} icon={<FileText size={18} />} />
        <BentoCard href="/finance-approval" label="รอผลไฟแนนซ์" value={dashboard.financeWaiting} icon={<ClipboardCheck size={18} />} />
        <BentoCard href="/vehicle-prep" label="รอส่งมอบ" value={dashboard.waitingDelivery} icon={<CalendarDays size={18} />} />
        <BentoCard href="/case-closure" label="ส่งมอบแล้ว" value={dashboard.delivered} icon={<Check size={18} />} />
        <BentoCard href="/calendar" label="งานวันนี้" value={dashboard.todayEvents} icon={<Bell size={18} />} wide />
      </section>

      <FloatingActionButton href="/booking-reports" label="เพิ่มรายงานจอง" icon={<Plus size={22} />} />
      <NativeBottomNav />
    </NativeAppShell>
  );
}

function BentoCard({
  href,
  label,
  value,
  icon,
  hint,
  wide = false
}: {
  href: string;
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <a
      href={href}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-[linear-gradient(145deg,#111820,#090d13)] p-4 shadow-glow transition hover:border-brand/60 hover:bg-[#111820] active:scale-[0.99] ${
        wide ? "col-span-2" : ""
      }`}
    >
      <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
          {icon}
        </span>
        <span className="h-2 w-2 rounded-full bg-brand/60 opacity-70 transition group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-sm font-black text-soft">{label}</p>
        <p className="mt-1 text-3xl font-black leading-none text-white">{value}</p>
        {hint && <p className="mt-1 text-xs font-bold text-brand">{hint}</p>}
      </div>
    </a>
  );
}

function formatDashboardMetrics(metrics: DashboardMetrics) {
  return {
    leads: metrics.leads.toLocaleString("th-TH"),
    newLeadsToday: metrics.newLeadsToday.toLocaleString("th-TH"),
    bookings: metrics.bookings.toLocaleString("th-TH"),
    financeWaiting: metrics.financeWaiting.toLocaleString("th-TH"),
    waitingDelivery: metrics.waitingDelivery.toLocaleString("th-TH"),
    delivered: metrics.delivered.toLocaleString("th-TH"),
    todayEvents: metrics.todayEvents ? `${metrics.todayEvents.toLocaleString("th-TH")} งาน` : "เปิดปฏิทิน"
  };
}
