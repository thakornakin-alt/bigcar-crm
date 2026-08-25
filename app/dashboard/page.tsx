"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Plus, User } from "lucide-react";
import { FloatingActionButton, NativeAppHeader, NativeAppShell, NativeBadge, NativeBottomNav, NativeCard } from "@/app/components/ui";
import { useSalesProfile } from "@/lib/use-sales-profile";
import { clearRetiredDashboardCaches, currentBangkokMonth, dashboardCacheKey } from "@/lib/dashboard-scope";

async function api<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
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

type DashboardScope = { month: string; targetUserId: string; targetDisplayName: string; sessionUserId: string; mode: "personal"; canSelectUser: boolean };
type SelectableUser = { id: string; displayName: string; branch: string };
type DashboardResponse = { metrics: DashboardMetrics; scope: DashboardScope; selectableUsers?: SelectableUser[]; complete?: boolean };

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
  const [staleAt, setStaleAt] = useState("");
  const [month, setMonth] = useState(() => currentBangkokMonth());
  const [targetUserId, setTargetUserId] = useState("");
  const [scope, setScope] = useState<DashboardScope | null>(null);
  const [selectableUsers, setSelectableUsers] = useState<SelectableUser[]>([]);

  useEffect(() => {
    if (!salesProfile?.id) return;
    const controller = new AbortController();
    clearRetiredDashboardCaches(window.sessionStorage);
    const effectiveTarget = targetUserId || salesProfile.id;
    const cacheKey = dashboardCacheKey(salesProfile.id, effectiveTarget, month);
    const cached = window.sessionStorage.getItem(cacheKey);
    let cachedMetrics: { metrics: DashboardMetrics; at: string } | null = null;
    if (cached) {
      try {
        cachedMetrics = JSON.parse(cached) as { metrics: DashboardMetrics; at: string };
        setMetrics(cachedMetrics.metrics);
      } catch { window.sessionStorage.removeItem(cacheKey); }
    }
    if (!cachedMetrics) {
      setMetrics(blankMetrics);
      setScope(null);
      setStaleAt("");
    }
    const query = new URLSearchParams({ month });
    if (targetUserId) query.set("userId", targetUserId);
    api<DashboardResponse>(`/api/dashboard/metrics?${query}`, controller.signal)
      .then((data) => {
        if (data.complete === false && cachedMetrics) { setStaleAt(cachedMetrics.at || ""); return; }
        const next = data.metrics || blankMetrics;
        setMetrics(next);
        setScope(data.scope);
        setSelectableUsers(data.selectableUsers || []);
        setStaleAt("");
        if (data.complete !== false) window.sessionStorage.setItem(cacheKey, JSON.stringify({ metrics: next, at: new Date().toISOString() }));
      })
      .catch((error) => { if (error instanceof DOMException && error.name === "AbortError") return; if (cachedMetrics) setStaleAt(cachedMetrics.at || ""); });
    return () => controller.abort();
  }, [month, salesProfile?.id, targetUserId]);

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

      <section className="mb-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate text-sm font-black text-white">ข้อมูลของ {scope?.targetDisplayName || salesProfile?.nickname || "ฉัน"}</p>
          {scope?.canSelectUser ? (
            <label className="flex min-w-0 items-center gap-2 text-xs font-bold text-soft">
              <span className="shrink-0">ดูข้อมูลของ</span>
              <select value={targetUserId || scope.targetUserId} onChange={(event) => setTargetUserId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-base font-bold text-white outline-none focus:border-brand/60 sm:w-44">
                {selectableUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-[44px_1fr_44px] items-center gap-2">
          <button type="button" aria-label="เดือนก่อน" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-soft hover:border-brand/40 hover:text-brand"><ChevronLeft size={18} /></button>
          <p className="text-center text-sm font-black text-brand">{formatThaiMonth(month)}</p>
          <button type="button" aria-label="เดือนถัดไป" disabled={month >= currentBangkokMonth()} onClick={() => setMonth((value) => shiftMonth(value, 1))} className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-soft hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-white/45">เริ่มนับข้อมูลใหม่ตั้งแต่ 26 ส.ค. 2569</p>
      </section>

      {staleAt ? <p className="mb-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">ข้อมูลอาจไม่ใช่ล่าสุด · สำเร็จล่าสุด {new Date(staleAt).toLocaleString("th-TH")}</p> : null}

      <section className="mb-4 grid auto-rows-[116px] grid-cols-2 gap-3">
        <BentoCard href="/leads" label="ลูกค้ามุ่งหวัง" value={dashboard.leads} hint={`ใหม่วันนี้ ${dashboard.newLeadsToday}`} icon={<User size={18} />} featured />
        <BentoCard href="/booking-reports" label="ยอดจอง" value={dashboard.bookings} icon={<FileText size={18} />} />
        <BentoCard href="/booking-delivery" label="Booking Delivery" value={dashboard.bookingDeliveries} hint={`ยอดจองทั้งหมด ${dashboard.bookingDeliveries}`} icon={<ClipboardCheck size={18} />} />
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
          ? "col-span-2 bg-[radial-gradient(circle_at_top_right,rgba(214,182,108,0.16),transparent_35%),linear-gradient(145deg,#17150f,#07080a)]"
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

function shiftMonth(month: string, amount: number) {
  const [year, number] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, number - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatThaiMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, number - 1, 15)));
}
