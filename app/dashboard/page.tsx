"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Check, ClipboardCheck, FileText, User } from "lucide-react";
import { AppHeader } from "@/app/components/ui";
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
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <AppHeader
        title="Dashboard V3"
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

      <section className="mb-4 grid auto-rows-[112px] grid-cols-2 gap-3">
        <BentoCard href="/leads" label="ลูกค้ามุ่งหวัง" value={dashboard.leads} hint={`ใหม่วันนี้ ${dashboard.newLeadsToday}`} icon={<User size={18} />} />
        <BentoCard href="/booking-reports" label="ยอดจอง" value={dashboard.bookings} icon={<FileText size={18} />} />
        <BentoCard href="/finance-approval" label="รอผลไฟแนนซ์" value={dashboard.financeWaiting} icon={<ClipboardCheck size={18} />} />
        <BentoCard href="/vehicle-prep" label="รอส่งมอบ" value={dashboard.waitingDelivery} icon={<CalendarDays size={18} />} />
        <BentoCard href="/case-closure" label="ส่งมอบแล้ว" value={dashboard.delivered} icon={<Check size={18} />} />
        <BentoCard href="/calendar" label="งานวันนี้" value={dashboard.todayEvents} icon={<Bell size={18} />} wide />
      </section>

      <section className="rounded-lg border border-line bg-panel/80 p-4 shadow-glow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Workspace</p>
            <p className="mt-1 text-xs text-soft">เลือกงานจากการ์ดด้านบนได้ทันที</p>
          </div>
          <span className="rounded-full border border-brand/35 px-3 py-1 text-xs font-black text-brand">
            CRM V3
          </span>
        </div>
      </section>
    </main>
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
      className={`group flex flex-col justify-between rounded-xl border border-line bg-panel p-4 shadow-glow transition hover:border-brand/60 hover:bg-[#111820] active:scale-[0.99] ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
          {icon}
        </span>
        <span className="h-2 w-2 rounded-full bg-brand/60 opacity-70 transition group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-sm font-bold text-soft">{label}</p>
        <p className="mt-1 text-2xl font-black text-white">{value}</p>
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
