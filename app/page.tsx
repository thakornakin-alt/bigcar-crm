"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Check, ClipboardCheck, FileText, User } from "lucide-react";
import { AppHeader } from "@/app/components/ui";
import type { Customer, ReportHistoryItem } from "@/lib/types";
import { useSalesProfile } from "@/lib/use-sales-profile";

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Home() {
  const { user: salesProfile } = useSalesProfile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);

  useEffect(() => {
    api<{ customers: Customer[]; total?: number }>("/api/customers")
      .then((data) => setCustomers(data.customers || []))
      .catch(() => setCustomers([]));
    api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=all")
      .then((data) => setReports(data.reports || []))
      .catch(() => setReports([]));
  }, []);

  const dashboard = useMemo(() => buildDashboardMetrics(customers, reports), [customers, reports]);

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
        <BentoCard href="/calendar" label="งานวันนี้" value="เปิดปฏิทิน" icon={<Bell size={18} />} wide />
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

function buildDashboardMetrics(customers: Customer[], reports: ReportHistoryItem[]) {
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const bookings = activeReports.filter((report) => report.type === "booking");
  const sales = activeReports.filter((report) => report.type === "sales");
  const salesPlateKeys = new Set(sales.map((report) => normalizePlate(report.plate)).filter(Boolean));
  const waitingDeliverySales = sales.filter((report) => report.status !== "closed" && report.status !== "delivered").length;
  const waitingDeliveryBookings = bookings.filter((report) => {
    const plate = normalizePlate(report.plate);
    if (salesPlateKeys.has(plate)) return false;
    if (isFinanceBooking(report)) return report.status === "finance_approved";
    return true;
  }).length;
  const financeWaiting = bookings.filter((report) => isFinanceBooking(report) && report.status !== "finance_approved" && !salesPlateKeys.has(normalizePlate(report.plate))).length;
  const waitingDelivery = waitingDeliverySales + waitingDeliveryBookings;
  const delivered = sales.filter((report) => report.status === "closed" || report.status === "delivered").length;
  const today = legacyToday();
  const newLeadsToday = customers.filter((customer) => String(customer.date || "") === today).length;

  return {
    leads: customers.length.toLocaleString("th-TH"),
    newLeadsToday: newLeadsToday.toLocaleString("th-TH"),
    bookings: bookings.length.toLocaleString("th-TH"),
    financeWaiting: financeWaiting.toLocaleString("th-TH"),
    waitingDelivery: waitingDelivery.toLocaleString("th-TH"),
    delivered: delivered.toLocaleString("th-TH")
  };
}

function legacyToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function extractLineValue(text: string, labels: string[]) {
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const compact = line.replace(/\*/g, "").trim();
    for (const label of labels) {
      if (compact.startsWith(label)) return compact.slice(label.length).replace(/^[:：\s-]+/, "").trim();
    }
  }
  return "";
}

function isFinanceBooking(report: ReportHistoryItem) {
  const payment = extractLineValue(report.reportText, ["การชำระเงิน"]);
  const source = `${payment} ${report.reportText}`.toLowerCase();
  return source.includes("ไฟแนนซ์") || source.includes("finance");
}
