"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, Calculator, CarFront, ChevronRight, Fuel, RefreshCw, WalletCards } from "lucide-react";
import { calculateMonthlyStatement, commissionReadinessReport } from "@/lib/commission";
import { COMMISSION_CLOSING_FIXTURES, COMMISSION_PREVIEW_RULES, COMMISSION_PREVIEW_SNAPSHOTS } from "@/lib/commission-fixtures";
import type { BookingDeliveryRecord } from "@/lib/types";

function baht(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

const statement = calculateMonthlyStatement(COMMISSION_PREVIEW_SNAPSHOTS, COMMISSION_PREVIEW_RULES, "USER-PREVIEW-BIG");

export function CommissionPreviewClient() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closingChoices, setClosingChoices] = useState<Record<string, string>>({});

  async function loadReadiness() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/booking-delivery?scope=all", { method: "GET", cache: "no-store" });
      const data = await response.json() as { records?: BookingDeliveryRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || "อ่านข้อมูลไม่สำเร็จ");
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อ่านข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadReadiness(); }, []);
  const readiness = useMemo(() => commissionReadinessReport(records), [records]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] overflow-x-hidden px-3 pb-16 sm:px-5 lg:px-8">
      <header className="mb-4 rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(214,182,108,0.16),transparent_42%),linear-gradient(145deg,#17191d,#08090b)] p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <Link href="/rdd-home" aria-label="กลับ RDD Home" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white"><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-black tracking-wider text-amber-100">PREVIEW · ไม่บันทึกข้อมูลจริง</span><span className="text-xs text-white/45">Rule {COMMISSION_PREVIEW_RULES.id}</span></div>
            <h1 className="mt-3 text-2xl font-black text-white sm:text-4xl">ค่าคอมเดือนนี้</h1>
            <p className="mt-1 text-sm text-white/55">แบบจำลอง {monthLabel(COMMISSION_PREVIEW_RULES.month)} · สูตรที่ยืนยันแล้ว</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["รับรู้แล้ว", `${statement.totalPhysicalCars} คัน`, CarFront],
          ["จำนวนแบบ Step", statement.totalWeightedCars.toFixed(1), Calculator],
          ["คอมสุทธิ", `${baht(statement.netVehicleCommission)} ฿`, WalletCards],
          ["Step", `${baht(statement.monthlyStep)} ฿`, BadgeCheck],
          ["ค่าน้ำมัน", `${baht(statement.fuelAllowance)} ฿`, Fuel],
          ["Adjustment", `${baht(statement.manualAdjustments)} ฿`, RefreshCw],
          ["ภาษีหัก ณ ที่จ่าย", `${baht(statement.withholdingTax)} ฿`, Calculator],
          ["รวม", `${baht(statement.finalTotal)} ฿`, WalletCards]
        ].map(([label, value, Icon]) => {
          const CardIcon = Icon as typeof CarFront;
          return <div key={String(label)} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-3"><CardIcon size={16} className="text-[#d6b66c]" /><p className="mt-3 text-[11px] text-white/50">{String(label)}</p><p className="mt-1 truncate text-lg font-black text-white">{String(value)}</p></div>;
        })}
      </section>

      <section className="mt-4 rounded-[24px] border border-white/10 bg-[#111317] p-3 sm:p-5">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d6b66c]">Recognized snapshots · fixture</p><h2 className="mt-1 text-xl font-black text-white">รายการค่าคอมรายคัน</h2></div><p className="text-xs text-white/45">หัก 3% เฉพาะรายคัน</p></div>
        <div className="mt-4 grid gap-2">
          {COMMISSION_PREVIEW_SNAPSHOTS.map((item) => <article key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 sm:grid-cols-[1.4fr_.55fr_.65fr_.65fr_.75fr] sm:items-center">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-lg bg-[#d6b66c] px-2 py-1 text-xs font-black text-[#17120a]">{item.commissionGroup}</span><strong className="truncate text-white">{item.vehiclePlate}</strong></div><p className="mt-1 truncate text-xs text-white/50">{item.vehicleModel}</p></div>
            <div className="hidden sm:block"><p className="text-[10px] text-white/40">ส่วนลด</p><p className="font-bold text-white">{baht(item.discountAmount)}</p></div>
            <div className="hidden sm:block"><p className="text-[10px] text-white/40">Weight</p><p className="font-bold text-white">{item.countWeight.toFixed(1)}</p></div>
            <div className="hidden sm:block"><p className="text-[10px] text-white/40">ภาษี 3%</p><p className="font-bold text-white">-{baht(item.withholdingTaxAmount)}</p></div>
            <div className="text-right"><p className="text-[10px] text-white/40">สุทธิ</p><p className="text-lg font-black text-emerald-200">{baht(item.netVehicleCommission)} ฿</p><p className="mt-1 text-[10px] text-white/40 sm:hidden">ลด {baht(item.discountAmount)} · Weight {item.countWeight}</p></div>
          </article>)}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#111317] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d6b66c]">Monthly closing · fixture</p><h2 className="mt-1 text-xl font-black text-white">ปิดยอดเดือน กรกฎาคม 2569</h2></div><span className="rounded-full bg-rose-300/10 px-3 py-1 text-xs font-bold text-rose-100">รอดำเนินการ</span></div>
          <p className="mt-2 text-sm text-white/50">ตัวเลือกด้านล่างเป็น Demo ในเครื่องเท่านั้น ไม่มี API mutation</p>
          <div className="mt-4 grid gap-3">{COMMISSION_CLOSING_FIXTURES.map((item) => <article key={item.bookingCaseId} className="rounded-2xl border border-white/8 bg-black/20 p-3">
            <div className="flex items-start justify-between gap-3"><div><strong className="text-white">{item.plate}</strong><p className="text-xs text-white/45">{item.model} · {item.status}</p></div><strong className="text-amber-100">~{baht(item.estimated)} ฿</strong></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setClosingChoices((value) => ({ ...value, [item.bookingCaseId]: "carry" }))} className={`min-h-11 rounded-xl border px-2 text-sm font-black ${closingChoices[item.bookingCaseId] === "carry" ? "border-[#d6b66c] bg-[#d6b66c] text-[#17120a]" : "border-white/12 text-white"}`}>ยกไปเดือนหน้า</button><button type="button" onClick={() => setClosingChoices((value) => ({ ...value, [item.bookingCaseId]: "drop" }))} className={`min-h-11 rounded-xl border px-2 text-sm font-black ${closingChoices[item.bookingCaseId] === "drop" ? "border-rose-300/50 bg-rose-300/15 text-rose-100" : "border-white/12 text-white"}`}>ไม่ยกไป</button></div>
          </article>)}</div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#111317] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d6b66c]">Real data · read only</p><h2 className="mt-1 text-xl font-black text-white">ความพร้อมข้อมูลจริง</h2></div>{loading && <RefreshCw size={18} className="animate-spin text-[#d6b66c]" />}</div>
          {error ? <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100"><p>{error}</p><button type="button" onClick={() => void loadReadiness()} className="mt-2 min-h-10 font-black">ลองใหม่</button></div> : <>
            <div className="mt-4 grid grid-cols-3 gap-2"><Metric label="พร้อม" value={readiness.eligible} tone="green" /><Metric label="ต้องตรวจ" value={readiness.needsReview} tone="amber" /><Metric label="ตัดออก" value={readiness.excluded} tone="muted" /></div>
            <div className="mt-4 space-y-2 text-sm text-white/65"><Reason label="ไม่มี Commission Group" value={readiness.reasons.missingCommissionGroup} /><Reason label="ไม่มี stable salesperson ID" value={readiness.reasons.missingSalespersonUserId} /><Reason label="ยังไม่รับรู้ยอด" value={readiness.reasons.unrecognized} /><Reason label="ไม่นับ" value={readiness.reasons.notCounted} /><Reason label="QA / excludeFromMetrics" value={readiness.reasons.qaExcluded} /></div>
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p>ระบบไม่ map FinalGrade เป็น Commission Group และไม่จับคู่ชื่อเซลส์แบบเดา รายการไม่ครบจึงอยู่ needs_review</p></div>
          </>}
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(214,182,108,.12),rgba(255,255,255,.025))] p-4 sm:p-5"><div className="flex items-center justify-between gap-4"><div><p className="font-black text-white">Home integration plan</p><p className="mt-1 text-sm text-white/50">การ์ดค่าคอมจะแสดงคาดการณ์ · รับรู้แล้ว · จำนวนคัน และ badge เมื่อปิดเดือนก่อนค้างอยู่</p></div><ChevronRight className="shrink-0 text-[#d6b66c]" /></div></section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "muted" }) {
  const color = tone === "green" ? "text-emerald-200" : tone === "amber" ? "text-amber-100" : "text-white/60";
  return <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-center"><p className={`text-2xl font-black ${color}`}>{value}</p><p className="text-[10px] text-white/40">{label}</p></div>;
}

function Reason({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><strong className="text-white">{value}</strong></div>;
}
