"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Check, ClipboardCheck, FileText, Plus, User } from "lucide-react";
import { FloatingActionButton, NativeAppHeader, NativeAppShell, NativeBadge, NativeBottomNav, NativeCard } from "@/app/components/ui";
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
  bookingDeliveries: number;
  bookingDeliveriesPending: number;
  todayEvents: number;
};

const blankMetrics: DashboardMetrics = {
  leads: 0,
  newLeadsToday: 0,
  bookings: 0,
  financeWaiting: 0,
  waitingDelivery: 0,
  delivered: 0,
  bookingDeliveries: 0,
  bookingDeliveriesPending: 0,
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

      <section className="mb-4 grid auto-rows-[116px] grid-cols-2 gap-3">
        <BentoCard href="/leads" label="ลูกค้ามุ่งหวัง" value={dashboard.leads} hint={`ใหม่วันนี้ ${dashboard.newLeadsToday}`} icon={<User size={18} />} featured />
        <BentoCard href="/booking-reports" label="ยอดจอง" value={dashboard.bookings} icon={<FileText size={18} />} />
        <BentoCard href="/booking-delivery" label="Booking Delivery" value={dashboard.bookingDeliveries} hint={`ติดจอง ${dashboard.bookingDeliveriesPending}`} icon={<ClipboardCheck size={18} />} />
        <BentoCard href="/finance-approval" label="รอผลไฟแนนซ์" value={dashboard.financeWaiting} icon={<ClipboardCheck size={18} />} />
        <BentoCard href="/vehicle-prep" label="รอส่งมอบ" value={dashboard.waitingDelivery} icon={<CalendarDays size={18} />} />
        <BentoCard href="/case-closure" label="ส่งมอบแล้ว" value={dashboard.delivered} icon={<Check size={18} />} />
      </section>

      <NativeCard className="mb-4 p-0">
        <Link href="/calendar" className="group flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
              <Bell size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-black text-white">งานวันนี้</p>
                <NativeBadge tone={metrics.todayEvents ? "brand" : "muted"}>{dashboard.todayEvents}</NativeBadge>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-soft">เปิดปฏิทินเพื่อตรวจงานที่ต้องทำและนัดหมายทั้งหมด</p>
            </div>
          </div>
          <span className="text-xl font-black text-brand transition group-hover:translate-x-0.5">›</span>
        </Link>
      </NativeCard>

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
  featured = false
}: {
  href: string;
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-white/10 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.22)] transition hover:border-brand/50 active:scale-[0.99] ${
        featured
          ? "col-span-2 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_35%),linear-gradient(145deg,#121b23,#070b10)]"
          : "bg-[linear-gradient(145deg,#101720,#070b10)]"
      }`}
    >
      <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
          {icon}
        </span>
        <span className="h-2 w-2 rounded-full bg-brand/60 opacity-70 transition group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-sm font-black text-soft">{label}</p>
        <p className={featured ? "mt-1 text-4xl font-black leading-none text-white" : "mt-1 text-3xl font-black leading-none text-white"}>{value}</p>
        {hint && <p className="mt-1 text-xs font-bold text-brand">{hint}</p>}
      </div>
    </Link>
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
    bookingDeliveries: metrics.bookingDeliveries.toLocaleString("th-TH"),
    bookingDeliveriesPending: metrics.bookingDeliveriesPending.toLocaleString("th-TH"),
    todayEvents: metrics.todayEvents ? `${metrics.todayEvents.toLocaleString("th-TH")} งาน` : "เปิดปฏิทิน"
  };
}
