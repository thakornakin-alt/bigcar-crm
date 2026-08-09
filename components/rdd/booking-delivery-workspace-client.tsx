"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, FileText, RotateCcw, Search, X } from "lucide-react";
import { useBookingDeliveryRead } from "@/components/rdd/use-booking-delivery-read";
import { RddEmpty, RddError, RddSkeleton, RddStatusChip } from "@/components/rdd/rdd-ui";
import { parseBusinessDate } from "@/lib/booking-delivery-v2";
import {
  filterRddWorkspaceRecords,
  bangkokDateKey,
  legacyStatusForRecord,
  purchaseTypeForRecord,
  type RddDisplayStatus,
  type RddPurchaseType,
  type RddReminderKind
} from "@/lib/rdd-phase2";
import { filterByOwnership, type OwnershipScope } from "@/lib/rdd-ownership";
import type { BookingDeliveryRecord } from "@/lib/types";
import { useSalesProfile } from "@/lib/use-sales-profile";

const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const statusOptions: Array<"all" | RddDisplayStatus> = ["all", "ยอดจองทั้งหมด", "รอผลไฟแนนซ์", "รอส่งมอบ", "ส่งมอบแล้ว", "ยกเลิก", "ไม่ระบุ"];

function thaiDate(value: unknown, includeTime = false) {
  const parsed = parseBusinessDate(value);
  if (parsed === null) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    year: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(new Date(parsed));
}

function money(value: unknown) {
  const amount = Number(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) && amount ? new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(amount) : "—";
}

function prepSummary(record: BookingDeliveryRecord) {
  const done = [record.spaFullSystemDone && "สปา", record.oilChangeDone && "น้ำมันเครื่อง", record.decalRemovalDone && "ลอกลาย", record.insuranceDone && "ประกัน"].filter(Boolean);
  return done.length ? done.join(" · ") : "—";
}

function pendingSummary(record: BookingDeliveryRecord) {
  const delivery = parseBusinessDate(record.deliveryDate);
  const now = parseBusinessDate(bangkokDateKey());
  if (delivery !== null && now !== null && delivery < now && !["ส่งมอบแล้ว", "ยกเลิก"].includes(legacyStatusForRecord(record))) return "เลยกำหนดส่งมอบ";
  if (record.garageReturnDate) return `รถกลับ ${thaiDate(record.garageReturnDate)}`;
  return "—";
}

export function BookingDeliveryWorkspaceClient({
  initialPending = "all",
  initialScope = "all",
  initialStatus = "all",
  initialSearch = "",
  initialMonth = "",
  currentYear,
  currentMonth
}: {
  initialPending?: "all" | RddReminderKind;
  initialScope?: OwnershipScope;
  initialStatus?: "all" | RddDisplayStatus;
  initialSearch?: string;
  initialMonth?: string;
  currentYear: number;
  currentMonth: number;
}) {
  const parsedMonth = initialMonth.match(/^(\d{4})-(\d{2})$/);
  const { records, loading, error, retry } = useBookingDeliveryRead();
  const { user } = useSalesProfile();
  const [year, setYear] = useState(parsedMonth ? Number(parsedMonth[1]) : currentYear);
  const [month, setMonth] = useState(parsedMonth ? Number(parsedMonth[2]) : currentMonth);
  const [query, setQuery] = useState(initialSearch);
  const [scope, setScope] = useState<OwnershipScope>(initialScope);
  const [purchase, setPurchase] = useState<"all" | RddPurchaseType>("all");
  const [status, setStatus] = useState<"all" | RddDisplayStatus>(statusOptions.includes(initialStatus) ? initialStatus : "all");
  const [pending, setPending] = useState<"all" | RddReminderKind>(initialPending);
  const [selectedId, setSelectedId] = useState("");

  const counts = useMemo(() => ({
    all: records.length,
    mine: filterByOwnership(records, "mine", user?.id || "").length,
    unassigned: filterByOwnership(records, "unassigned", user?.id || "").length
  }), [records, user?.id]);

  const visible = useMemo(() => filterRddWorkspaceRecords(records, {
    year,
    month,
    query,
    scope,
    userId: user?.id || "",
    purchaseType: purchase,
    status,
    pending
  }).sort((a, b) => String(b.bookingDate || b.updatedAt).localeCompare(String(a.bookingDate || a.updatedAt))), [records, year, month, query, scope, user?.id, purchase, status, pending]);
  const selected = useMemo(() => records.find((record) => record.id === selectedId) || null, [records, selectedId]);

  function clearFilters() {
    setYear(currentYear);
    setMonth(currentMonth);
    setQuery("");
    setScope("all");
    setPurchase("all");
    setStatus("all");
    setPending("all");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] overflow-x-clip px-3 pb-28 sm:px-5 lg:px-6">
      <header className="mb-4 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(116,31,44,0.42),transparent_34%),linear-gradient(145deg,#1b1b1f,#09090b)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d6b66c]">RDD Workspace · Read only</p>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Booking Delivery Workspace</h1>
            <p className="mt-1 text-sm text-white/52">มุมมองทำงานแบบตาราง โดยไม่แก้ข้อมูลต้นทาง</p>
          </div>
          <Link href="/rdd-home" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 text-sm font-black text-white"><ChevronRight size={17} className="rotate-180" />RDD Home</Link>
        </div>

        <div className="mt-4 grid gap-2 xl:grid-cols-[minmax(260px,1fr)_auto_auto_auto_auto_auto]">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-black/25 px-3 focus-within:border-[#d6b66c]/70">
            <Search size={18} className="text-[#d6b66c]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ทะเบียนก่อน แล้วตามด้วยชื่อลูกค้า" className="w-full bg-transparent text-white outline-none placeholder:text-white/35" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="เดือน" value={month} onChange={(event) => setMonth(Number(event.target.value))} className="workspace-select">{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
            <select aria-label="ปี" value={year} onChange={(event) => setYear(Number(event.target.value))} className="workspace-select">{Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).map((item) => <option key={item} value={item}>{item + 543}</option>)}</select>
          </div>
          <select aria-label="ประเภทซื้อ" value={purchase} onChange={(event) => setPurchase(event.target.value as typeof purchase)} className="workspace-select"><option value="all">ทุกประเภทซื้อ</option><option value="เงินสด">เงินสด</option><option value="ไฟแนนซ์">ไฟแนนซ์</option><option value="ไม่ระบุ">ไม่ระบุ</option></select>
          <select aria-label="สถานะ" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="workspace-select">{statusOptions.map((item) => <option key={item} value={item}>{item === "all" ? "ทุกสถานะ" : item}</option>)}</select>
          <select aria-label="งานค้าง" value={pending} onChange={(event) => setPending(event.target.value as typeof pending)} className="workspace-select"><option value="all">งานค้างทั้งหมด</option><option value="delivery_today">ส่งมอบวันนี้</option><option value="delivery_tomorrow">ส่งมอบพรุ่งนี้</option><option value="delivery_overdue">เลยกำหนดส่งมอบ</option><option value="garage_return_due">ถึงกำหนดรถกลับ</option></select>
          <button type="button" onClick={clearFilters} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 text-sm font-black text-white"><RotateCcw size={16} />ล้าง</button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:flex">
          {(["all", "mine", "unassigned"] as OwnershipScope[]).map((item) => (
            <button key={item} type="button" onClick={() => setScope(item)} className={`min-h-11 rounded-xl border px-3 text-xs font-black sm:text-sm ${scope === item ? "border-[#d6b66c] bg-[#d6b66c] text-[#17120a]" : "border-white/10 bg-black/20 text-white/60"}`}>
              {item === "all" ? "ทั้งหมด" : item === "mine" ? "ของฉัน" : "ยังไม่ระบุเจ้าของ"} · {counts[item].toLocaleString("th-TH")}
            </button>
          ))}
        </div>
      </header>

      {error ? <RddError message={error} onRetry={retry} /> : loading ? <RddSkeleton rows={6} /> : (
        <>
          {scope === "mine" && visible.length === 0 ? (
            <RddEmpty title="ยังไม่มีรายการที่ผูกกับบัญชีนี้" detail="ข้อมูลเก่ายังอยู่ใน ‘ทั้งหมด’" />
          ) : visible.length === 0 ? (
            <RddEmpty title="ไม่พบรายการตามตัวกรอง" detail="ลองล้างตัวกรองหรือเลือกเดือนอื่น ข้อมูลที่ไม่ทราบวันที่ยังไม่ถูกซ่อน" />
          ) : (
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0b0e] shadow-[0_20px_60px_rgba(0,0,0,0.26)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div><p className="font-black text-white">รายการติดตาม</p><p className="text-xs text-white/45">{visible.length.toLocaleString("th-TH")} รายการ · คลิกเพื่อดูรายละเอียด</p></div>
                <span className="rounded-full border border-[#d6b66c]/30 bg-[#d6b66c]/10 px-3 py-1 text-xs font-black text-[#f6df9d]">READ ONLY</span>
              </div>

              <div className="hidden max-w-full overflow-x-auto lg:block">
                <table className="min-w-[1960px] table-fixed border-separate border-spacing-0 text-left text-xs text-white">
                  <thead className="sticky top-0 z-30 bg-[#17171b] text-white/52">
                    <tr>{[
                      ["", "sticky left-0 w-12"], ["ทะเบียน", "sticky left-12 w-[120px]"], ["ลูกค้า", "sticky left-[168px] w-[180px]"], ["ประเภทซื้อ", "sticky left-[348px] w-[110px]"], ["สถานะ", "sticky left-[458px] w-[150px]"],
                      ["รถ", "w-[230px]"], ["ปี", "w-16"], ["สี", "w-24"], ["เกรด", "w-20"], ["วันที่จอง", "w-28"], ["ราคาตั้ง", "w-28"], ["ราคาขาย", "w-28"], ["ส่วนลด", "w-24"], ["เซลล์", "w-32"], ["เจ้าของ", "w-36"], ["ไฟแนนซ์", "w-44"], ["วันนัดส่ง", "w-28"], ["สถานที่", "w-36"], ["เตรียมรถ", "w-52"], ["เอกสาร", "w-24"]
                    ].map(([label, classes]) => <th key={label} className={`${classes} border-b border-r border-white/8 bg-[#17171b] px-3 py-3 font-black`}>{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {visible.map((record) => (
                      <tr key={record.id} tabIndex={0} onClick={() => setSelectedId(record.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedId(record.id); }} className="cursor-pointer hover:bg-white/[0.04] focus:outline focus:outline-2 focus:outline-[#d6b66c]">
                        <td className="sticky left-0 z-20 border-b border-r border-white/8 bg-[#101014] px-3 py-3"><span className={`block h-2.5 w-2.5 rounded-full ${legacyStatusForRecord(record) === "ส่งมอบแล้ว" ? "bg-emerald-300" : legacyStatusForRecord(record) === "ยกเลิก" ? "bg-rose-300" : "bg-[#d6b66c]"}`} /></td>
                        <td className="sticky left-12 z-20 border-b border-r border-white/8 bg-[#101014] px-3 py-3 font-black text-[#f6df9d]">{record.plate || "—"}</td>
                        <td className="sticky left-[168px] z-20 max-w-[180px] truncate border-b border-r border-white/8 bg-[#101014] px-3 py-3 font-bold">{record.customerName || "—"}</td>
                        <td className="sticky left-[348px] z-20 border-b border-r border-white/8 bg-[#101014] px-3 py-3">{purchaseTypeForRecord(record)}</td>
                        <td className="sticky left-[458px] z-20 border-b border-r border-white/8 bg-[#101014] px-3 py-3"><RddStatusChip record={record} /></td>
                        <td className="border-b border-r border-white/8 px-3 py-3">{[record.brand, record.model].filter(Boolean).join(" ") || "—"}</td>
                        <td className="border-b border-r border-white/8 px-3 py-3">{record.year || "—"}</td><td className="border-b border-r border-white/8 px-3 py-3">{record.color || "—"}</td><td className="border-b border-r border-white/8 px-3 py-3">—</td>
                        <td className="border-b border-r border-white/8 px-3 py-3">{thaiDate(record.bookingDate)}</td><td className="border-b border-r border-white/8 px-3 py-3">{money(record.salePrice)}</td><td className="border-b border-r border-white/8 px-3 py-3">{money(record.finalPrice)}</td><td className="border-b border-r border-white/8 px-3 py-3">{money(record.centralDiscount)}</td>
                        <td className="border-b border-r border-white/8 px-3 py-3">{record.saleName || "—"}</td><td className="border-b border-r border-white/8 px-3 py-3">{record.ownerName || "ยังไม่ระบุ"}</td><td className="max-w-44 truncate border-b border-r border-white/8 px-3 py-3">{record.financeCaseNote || (record.financeCaseSubmitted ? "ส่งเคสแล้ว" : "—")}</td>
                        <td className="border-b border-r border-white/8 px-3 py-3">{thaiDate(record.deliveryDate, true)}</td><td className="border-b border-r border-white/8 px-3 py-3">{record.deliveryLocation || "—"}</td><td className="border-b border-r border-white/8 px-3 py-3">{prepSummary(record)}</td>
                        <td className="border-b border-white/8 px-3 py-3">{record.bookingReportId || record.salesReportId || record.financeAttachmentIds?.length ? "มี" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-white/10 lg:hidden">
                {visible.map((record) => (
                  <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} className="block w-full p-4 text-left active:bg-white/[0.05]">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-lg font-black text-[#f6df9d]">{record.plate || "ไม่ระบุทะเบียน"}</p><p className="mt-1 truncate text-sm font-bold text-white">{record.customerName || "ไม่ระบุลูกค้า"}</p></div><RddStatusChip record={record} /></div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-white/52"><span>ประเภทซื้อ <b className="text-white">{purchaseTypeForRecord(record)}</b></span><span>วันนัดส่ง <b className="text-white">{thaiDate(record.deliveryDate)}</b></span><span className="col-span-2">งานค้าง <b className="text-amber-100">{pendingSummary(record)}</b></span></div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selected && <WorkspaceDetail record={selected} onClose={() => setSelectedId("")} />}

      <style jsx>{`
        .workspace-select { min-height: 48px; border-radius: 16px; border: 1px solid rgba(255,255,255,.12); background: #111114; padding: 0 12px; color: white; font-size: 13px; font-weight: 800; }
      `}</style>
    </main>
  );
}

function WorkspaceDetail({ record, onClose }: { record: BookingDeliveryRecord; onClose: () => void }) {
  return (
    <div data-testid="workspace-detail-overlay" className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside data-testid="workspace-detail-panel" className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-white/10 bg-[#0c0c0f] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d6b66c]">Read-only detail</p><h2 className="mt-2 text-2xl font-black text-white">{record.plate || "ไม่ระบุทะเบียน"}</h2><p className="mt-1 text-sm text-white/48">{record.customerName || "ไม่ระบุลูกค้า"}</p></div>
          <button type="button" aria-label="ปิดรายละเอียด" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white"><X size={20} /></button>
        </div>
        <div className="mt-5"><RddStatusChip record={record} /></div>
        <DetailGroup title="ลูกค้าและการขาย" items={[["ลูกค้า", record.customerName], ["ประเภทซื้อ", purchaseTypeForRecord(record)], ["เซลล์", record.saleName], ["เจ้าของ", record.ownerName || "ยังไม่ระบุ"]]} />
        <DetailGroup title="รถ" items={[["รถ", [record.brand, record.model, record.year].filter(Boolean).join(" ")], ["สี", record.color], ["เลขเครื่อง", record.engineNo], ["เลขตัวถัง", record.chassisNo]]} />
        <DetailGroup title="Booking" items={[["Booking ID", record.bookingId], ["วันที่จอง", thaiDate(record.bookingDate)], ["ราคาตั้ง", money(record.salePrice)], ["ราคาขาย", money(record.finalPrice)], ["ส่วนลด", money(record.centralDiscount)]]} />
        <DetailGroup title="ไฟแนนซ์" items={[["ส่งเคสแล้ว", record.financeCaseSubmitted ? "ใช่" : "—"], ["เวลาส่งเคส", thaiDate(record.financeCaseSubmittedAt, true)], ["หมายเหตุ", record.financeCaseNote || "—"]]} />
        <DetailGroup title="ส่งมอบและเตรียมรถ" items={[["วันนัดส่ง", thaiDate(record.deliveryDate, true)], ["สถานที่", record.deliveryLocation], ["วันรถกลับ", thaiDate(record.garageReturnDate)], ["งานที่ทำแล้ว", prepSummary(record)]]} />
        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="font-black text-white">เอกสาร / ประวัติ</h3><div className="mt-3 flex flex-wrap gap-2">{record.bookingReportId && <Link href="/booking-reports" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-sm font-black text-white"><FileText size={16} />รายงานจอง</Link>}{record.salesReportId && <Link href="/sales-reports" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-sm font-black text-white"><FileText size={16} />รายงานขาย</Link>}<Link href="/documents" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-sm font-black text-white"><FileText size={16} />เอกสาร</Link></div><p className="mt-3 text-xs text-white/42">อัปเดตล่าสุด {thaiDate(record.updatedAt, true)} · Activity รายรายการยังไม่เปิดใน Phase 2</p></section>
        <button type="button" onClick={onClose} className="mt-5 min-h-12 w-full rounded-xl border border-white/12 bg-white/5 font-black text-white sm:hidden">ปิด</button>
      </aside>
    </div>
  );
}

function DetailGroup({ title, items }: { title: string; items: Array<[string, unknown]> }) {
  return <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="font-black text-white">{title}</h3><div className="mt-3 grid grid-cols-2 gap-3">{items.map(([label, value]) => <div key={label} className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d6b66c]">{label}</p><p className="mt-1 break-words text-sm font-bold text-white">{String(value || "—")}</p></div>)}</div></section>;
}
