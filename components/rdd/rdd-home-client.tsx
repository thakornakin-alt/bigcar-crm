"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CarFront, ChevronRight, Search, Truck } from "lucide-react";
import { useBookingDeliveryRead } from "@/components/rdd/use-booking-delivery-read";
import { RddEmpty, RddError, RddSection, RddSkeleton, RddStatusChip } from "@/components/rdd/rdd-ui";
import { parseBusinessDate } from "@/lib/booking-delivery-v2";
import {
  deriveRddHomeKpis,
  deriveRddReminders,
  filterRddWorkspaceRecords,
  legacyStatusForRecord,
  purchaseTypeForRecord,
  upcomingRddDeliveries
} from "@/lib/rdd-phase2";
import type { OwnershipScope } from "@/lib/rdd-ownership";
import { useSalesProfile } from "@/lib/use-sales-profile";

const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function thaiDate(value: string) {
  const parsed = parseBusinessDate(value);
  if (parsed === null) return "—";
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" }).format(new Date(parsed));
}

export function RddHomeClient({ initialYear, initialMonth }: { initialYear: number; initialMonth: number }) {
  const { records, loading, error, retry } = useBookingDeliveryRead();
  const { user } = useSalesProfile();
  const [scope, setScope] = useState<OwnershipScope>("all");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const scoped = useMemo(() => filterRddWorkspaceRecords(records, {
    year,
    month,
    scope,
    userId: user?.id || "",
    query
  }), [records, year, month, scope, user?.id, query]);
  const kpis = useMemo(() => deriveRddHomeKpis(scoped, year, month), [scoped, year, month]);
  const reminders = useMemo(() => deriveRddReminders(scoped), [scoped]);
  const upcoming = useMemo(() => upcomingRddDeliveries(scoped), [scoped]);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const cards = [
    { label: "ยอดจองเดือนนี้", value: kpis.newBookings, filter: "ยอดจองทั้งหมด", icon: CarFront, tone: "text-[#f6df9d]" },
    { label: "รอจัดไฟแนนซ์", value: kpis.waitingFinanceSubmission, filter: "รอจัดไฟแนนซ์", icon: CalendarClock, tone: "text-orange-200" },
    { label: "รอผลไฟแนนซ์", value: kpis.waitingFinanceResult, filter: "รอผลไฟแนนซ์", icon: CalendarClock, tone: "text-amber-200" },
    { label: "รอส่งมอบ", value: kpis.waitingDelivery, filter: "รอส่งมอบ", icon: Truck, tone: "text-sky-200" },
    { label: "ส่งมอบแล้ว", value: kpis.delivered, filter: "ส่งมอบแล้ว", icon: CarFront, tone: "text-emerald-200" },
    { label: "ลูกค้าชะลอ", value: kpis.customerPaused, filter: "ลูกค้าชะลอการดำเนินการ", icon: CalendarClock, tone: "text-violet-200" }
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-28 sm:px-5 lg:px-6">
      <header className="mb-5 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(116,31,44,0.45),transparent_36%),linear-gradient(145deg,#1b1b1f,#09090b)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.3)] sm:p-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d6b66c]">RDD Command Center</p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">วันนี้ต้องตามอะไร</h1>
          <p className="mt-2 text-sm text-white/58">ภาพรวมงาน Booking Delivery วันนี้</p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-black/25 px-3 focus-within:border-[#d6b66c]/70">
            <Search size={18} className="text-[#d6b66c]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาทะเบียน หรือชื่อลูกค้า" className="w-full bg-transparent text-white outline-none placeholder:text-white/35" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="เดือน" value={month} onChange={(event) => setMonth(Number(event.target.value))} className="min-h-12 rounded-2xl border border-white/12 bg-[#111114] px-3 text-sm font-bold text-white">
              {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
            <select aria-label="ปี" value={year} onChange={(event) => setYear(Number(event.target.value))} className="min-h-12 rounded-2xl border border-white/12 bg-[#111114] px-3 text-sm font-bold text-white">
              {Array.from({ length: 7 }, (_, index) => initialYear - 3 + index).map((item) => <option key={item} value={item}>{item + 543}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 rounded-2xl border border-white/12 bg-black/25 p-1">
            {(["all", "mine"] as OwnershipScope[]).map((item) => (
              <button key={item} type="button" onClick={() => setScope(item)} className={`min-h-10 rounded-xl px-4 text-sm font-black ${scope === item ? "bg-[#d6b66c] text-[#16120b]" : "text-white/60"}`}>
                {item === "all" ? "ทั้งหมด" : "ของฉัน"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error ? <RddError message={error} onRetry={retry} /> : loading ? <RddSkeleton rows={4} /> : (
        <div className="grid gap-4">
          {scope === "mine" && scoped.length === 0 && (
            <RddEmpty title="ยังไม่มีรายการที่ผูกกับบัญชีนี้" detail="ข้อมูลเก่ายังอยู่ใน ‘ทั้งหมด’" />
          )}

          <RddSection eyebrow="Today / Urgent" title="งานที่ต้องตาม">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {reminders.map((item) => (
                <Link key={item.kind} href={`/booking-delivery-workspace?pending=${item.filterValue}&scope=${scope}`} className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 transition hover:border-[#d6b66c]/45 sm:min-h-14 sm:rounded-2xl sm:px-4">
                  <span className="text-sm font-bold text-white">{item.label}</span>
                  <span className="flex items-center gap-1.5 font-black text-[#f6df9d]">{item.count.toLocaleString("th-TH")} <ChevronRight size={16} /></span>
                </Link>
              ))}
            </div>
          </RddSection>

          <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={`/booking-delivery-workspace?month=${monthKey}&status=${encodeURIComponent(card.filter)}&scope=${scope}`} className="rounded-[20px] border border-white/10 bg-white/[0.045] p-3.5 transition hover:border-[#d6b66c]/45 sm:rounded-[24px] sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold leading-5 text-white/55 sm:text-sm">{card.label}</p>
                    <Icon size={19} className={card.tone} />
                  </div>
                  <p className={`mt-2.5 text-3xl font-black sm:mt-4 ${card.tone}`}>{card.value.toLocaleString("th-TH")}</p>
                </Link>
              );
            })}
          </section>

          <RddSection eyebrow="Upcoming" title="นัดส่งมอบถัดไป" action={<span className="text-xs text-white/42">ใกล้ที่สุดก่อน</span>}>
              {upcoming.length ? (
                <div className="grid gap-2">
                  {upcoming.map((record) => (
                    <Link key={record.id} href={`/booking-delivery-workspace?search=${encodeURIComponent(record.plate || record.customerName)}`} className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 hover:border-[#d6b66c]/45">
                      <span className="w-16 text-center text-xs font-black text-[#f6df9d]">{thaiDate(record.deliveryDate)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-black text-white">{record.plate || "ไม่ระบุทะเบียน"}</span>
                        <span className="block truncate text-xs text-white/48">{record.customerName || "ไม่ระบุลูกค้า"} · {purchaseTypeForRecord(record)}</span>
                      </span>
                      <RddStatusChip status={legacyStatusForRecord(record)} />
                    </Link>
                  ))}
                </div>
              ) : <RddEmpty title="ยังไม่มีนัดส่งมอบข้างหน้า" detail="แสดงเฉพาะรายการที่มีวันนัดส่งมอบชัดเจน" />}
          </RddSection>

          {kpis.unknownBookingDate > 0 && (
            <details data-testid="historical-data-notice" className="group rounded-xl border border-amber-300/20 bg-amber-300/[0.055] text-sm text-amber-100">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">ข้อมูลเก่า {kpis.unknownBookingDate.toLocaleString("th-TH")} รายการไม่มีวันที่จอง</span>
                <span className="shrink-0 text-xs font-black text-[#f6df9d]">ดูรายละเอียด</span>
              </summary>
              <p className="border-t border-amber-200/10 px-3 py-2 text-xs leading-5 text-amber-100/75">รายการยังคงแสดงอยู่ และระบบจะไม่คาดเดาวันที่ย้อนหลัง</p>
            </details>
          )}

          <Link href={`/booking-delivery-workspace?scope=${scope}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#d6b66c] px-5 font-black text-[#17120a]">
            เปิด Booking Delivery Workspace <ChevronRight size={18} />
          </Link>
        </div>
      )}
    </main>
  );
}
