"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, Loader2, Pencil, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useBookingDeliveryRead } from "@/components/rdd/use-booking-delivery-read";
import { RddEmpty, RddError, RddSkeleton, RddStatusChip } from "@/components/rdd/rdd-ui";
import { parseBusinessDate } from "@/lib/booking-delivery-v2";
import {
  filterRddWorkspaceRecords,
  bangkokDateKey,
  legacyStatusForRecord,
  operationalRddRecords,
  purchaseTypeForRecord,
  type RddDisplayStatus,
  type RddPurchaseType,
  type RddReminderKind
} from "@/lib/rdd-phase2";
import { filterByOwnership, type OwnershipScope } from "@/lib/rdd-ownership";
import type { BookingDeliveryRecord } from "@/lib/types";
import { useSalesProfile } from "@/lib/use-sales-profile";
import { resolveCaseDocumentManifest } from "@/lib/rdd-case-documents";
import { RDD_DELIVERY_LOCATIONS, type RddWorkspaceChanges } from "@/lib/rdd-workspace-fields";
import { RDD_CASE_STATUS_LABELS, RDD_PURCHASE_TYPE_LABELS, isStatusValidForPurchaseType, statusesForPurchaseType, type RddCanonicalPurchaseType, type RddCaseStatus } from "@/lib/rdd-phase3b";

const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const statusOptions: Array<"all" | RddDisplayStatus> = ["all", "ยอดจองทั้งหมด", "รอจัดไฟแนนซ์", "รอผลไฟแนนซ์", "รอส่งมอบ", "อนุมัติ / รอส่งมอบ", "ตัดยอดแล้ว / รอส่งมอบ", "ลูกค้าชะลอการดำเนินการ", "ส่งมอบแล้ว", "ยกเลิก", "ไม่ระบุ"];

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
  editEnabled = false,
  initialPending = "all",
  initialScope = "all",
  initialStatus = "all",
  initialSearch = "",
  initialMonth = "",
  currentYear,
  currentMonth
}: {
  editEnabled?: boolean;
  initialPending?: "all" | RddReminderKind;
  initialScope?: OwnershipScope;
  initialStatus?: "all" | RddDisplayStatus;
  initialSearch?: string;
  initialMonth?: string;
  currentYear: number;
  currentMonth: number;
}) {
  const parsedMonth = initialMonth.match(/^(\d{4})-(\d{2})$/);
  const { records, revision, loading, error, retry, replaceRecord } = useBookingDeliveryRead();
  const { user } = useSalesProfile();
  const [year, setYear] = useState(parsedMonth ? Number(parsedMonth[1]) : currentYear);
  const [month, setMonth] = useState(parsedMonth ? Number(parsedMonth[2]) : currentMonth);
  const [query, setQuery] = useState(initialSearch);
  const [scope, setScope] = useState<OwnershipScope>(initialScope);
  const [purchase, setPurchase] = useState<"all" | RddPurchaseType>("all");
  const [status, setStatus] = useState<"all" | RddDisplayStatus>(statusOptions.includes(initialStatus) ? initialStatus : "all");
  const [pending, setPending] = useState<"all" | RddReminderKind>(initialPending);
  const [includeQa, setIncludeQa] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const operationalRecords = useMemo(() => operationalRddRecords(records), [records]);
  const counts = useMemo(() => ({
    all: operationalRecords.length,
    mine: filterByOwnership(operationalRecords, "mine", user?.id || "").length,
    unassigned: filterByOwnership(operationalRecords, "unassigned", user?.id || "").length
  }), [operationalRecords, user?.id]);

  const visible = useMemo(() => filterRddWorkspaceRecords(records, {
    year,
    month,
    query,
    scope,
    userId: user?.id || "",
    purchaseType: purchase,
    status,
    pending,
    includeQa
  }).sort((a, b) => String(b.bookingDate || b.updatedAt).localeCompare(String(a.bookingDate || a.updatedAt))), [records, year, month, query, scope, user?.id, purchase, status, pending, includeQa]);
  const selected = useMemo(() => records.find((record) => record.id === selectedId) || null, [records, selectedId]);
  const scopeLabel = scope === "all" ? "ทั้งหมด" : scope === "mine" ? "ของฉัน" : "ยังไม่ระบุ";

  function clearFilters() {
    setYear(currentYear);
    setMonth(currentMonth);
    setQuery("");
    setScope("all");
    setPurchase("all");
    setStatus("all");
    setPending("all");
    setIncludeQa(false);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] overflow-x-clip px-3 pb-28 sm:px-5 lg:px-6">
      <header data-testid="workspace-header" className="mb-3 rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(116,31,44,0.42),transparent_34%),linear-gradient(145deg,#1b1b1f,#09090b)] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:mb-4 sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="hidden text-[10px] font-black uppercase tracking-[0.24em] text-[#d6b66c] sm:block">RDD Workspace · {editEnabled ? "Controlled edit" : "Read only"}</p>
            <h1 className="truncate text-xl font-black text-white sm:mt-2 sm:text-3xl">Booking Delivery<span className="hidden sm:inline"> Workspace</span></h1>
            <p data-testid="workspace-mobile-summary" className="mt-0.5 text-xs font-bold text-white/55 sm:hidden">{monthNames[month - 1]} {year + 543} · {scopeLabel} {visible.length.toLocaleString("th-TH")} คัน</p>
            <p className="mt-1 hidden text-sm text-white/52 sm:block">{editEnabled ? "แก้ไขเฉพาะข้อมูลที่อนุญาต พร้อมป้องกันข้อมูลทับกัน" : "มุมมองทำงานแบบตาราง โดยไม่แก้ข้อมูลต้นทาง"}</p>
          </div>
          <Link href="/rdd-home" aria-label="กลับ RDD Home" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white sm:min-w-0 sm:gap-2 sm:px-3 sm:text-sm sm:font-black"><ChevronLeft size={18} /><span className="hidden sm:inline">RDD Home</span></Link>
        </div>

        <div className="mt-3 grid gap-2 sm:mt-4 xl:grid-cols-[minmax(260px,1fr)_auto_auto_auto_auto_auto_auto]">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-black/25 px-3 focus-within:border-[#d6b66c]/70">
            <Search size={18} className="text-[#d6b66c]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ทะเบียนก่อน แล้วตามด้วยชื่อลูกค้า" className="w-full bg-transparent text-white outline-none placeholder:text-white/35" />
          </label>
          <div className="hidden grid-cols-2 gap-2 sm:grid">
            <select aria-label="เดือน" value={month} onChange={(event) => setMonth(Number(event.target.value))} className="workspace-select">{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
            <select aria-label="ปี" value={year} onChange={(event) => setYear(Number(event.target.value))} className="workspace-select">{Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).map((item) => <option key={item} value={item}>{item + 543}</option>)}</select>
          </div>
          <select aria-label="ประเภทซื้อ" value={purchase} onChange={(event) => setPurchase(event.target.value as typeof purchase)} className="workspace-select hidden sm:block"><option value="all">ทุกประเภทซื้อ</option><option value="ซื้อสด">ซื้อสด</option><option value="ไฟแนนซ์">ไฟแนนซ์</option><option value="ไม่ระบุ">ไม่ระบุ</option></select>
          <select aria-label="สถานะ" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="workspace-select hidden sm:block">{statusOptions.map((item) => <option key={item} value={item}>{item === "all" ? "ทุกสถานะ" : item}</option>)}</select>
          <select aria-label="งานค้าง" value={pending} onChange={(event) => setPending(event.target.value as typeof pending)} className="workspace-select hidden sm:block"><option value="all">งานค้างทั้งหมด</option><option value="delivery_today">ส่งมอบวันนี้</option><option value="delivery_tomorrow">ส่งมอบพรุ่งนี้</option><option value="delivery_overdue">เลยกำหนดส่งมอบ</option><option value="garage_return_due">ถึงกำหนดรถกลับ</option></select>
          <label className="hidden min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-black/20 px-3 text-xs font-black text-white/60 sm:flex"><input data-testid="include-qa-toggle-desktop" type="checkbox" checked={includeQa} onChange={(event) => setIncludeQa(event.target.checked)} className="h-4 w-4 accent-[#d6b66c]" />รวมข้อมูลทดสอบ</label>
          <button type="button" onClick={clearFilters} className="hidden min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 text-sm font-black text-white sm:inline-flex"><RotateCcw size={16} />ล้าง</button>
        </div>

        <div data-testid="workspace-mobile-filters" className="mt-2 grid grid-cols-4 gap-1.5 sm:hidden">
          <select aria-label="เดือนแบบย่อ" value={month} onChange={(event) => setMonth(Number(event.target.value))} className="workspace-select compact">{monthNames.map((name, index) => <option key={name} value={index + 1}>{name.slice(0, 3)}</option>)}</select>
          <select aria-label="สถานะแบบย่อ" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="workspace-select compact">{statusOptions.map((item) => <option key={item} value={item}>{item === "all" ? "สถานะ" : item}</option>)}</select>
          <select aria-label="งานค้างแบบย่อ" value={pending} onChange={(event) => setPending(event.target.value as typeof pending)} className="workspace-select compact"><option value="all">งานค้าง</option><option value="delivery_today">วันนี้</option><option value="delivery_tomorrow">พรุ่งนี้</option><option value="delivery_overdue">เลยกำหนด</option><option value="garage_return_due">รถกลับ</option></select>
          <details className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/5 px-1 text-[11px] font-black text-white"><SlidersHorizontal size={14} />ตัวกรอง</summary>
            <div className="absolute right-0 z-40 mt-2 grid w-[min(320px,calc(100vw-24px))] gap-2 rounded-2xl border border-white/12 bg-[#151519] p-3 shadow-2xl">
              <select aria-label="ปีเพิ่มเติม" value={year} onChange={(event) => setYear(Number(event.target.value))} className="workspace-select">{Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).map((item) => <option key={item} value={item}>{item + 543}</option>)}</select>
              <select aria-label="ประเภทซื้อเพิ่มเติม" value={purchase} onChange={(event) => setPurchase(event.target.value as typeof purchase)} className="workspace-select"><option value="all">ทุกประเภทซื้อ</option><option value="ซื้อสด">ซื้อสด</option><option value="ไฟแนนซ์">ไฟแนนซ์</option><option value="ไม่ระบุ">ไม่ระบุ</option></select>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-bold text-white/70"><input data-testid="include-qa-toggle" type="checkbox" checked={includeQa} onChange={(event) => setIncludeQa(event.target.checked)} className="h-4 w-4 accent-[#d6b66c]" />รวมข้อมูลทดสอบ</label>
              <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 text-sm font-black text-white"><RotateCcw size={16} />ล้างตัวกรอง</button>
            </div>
          </details>
        </div>

        <div data-testid="workspace-scope-controls" className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 sm:mt-3 sm:gap-2">
          {(["all", "mine", "unassigned"] as OwnershipScope[]).map((item) => (
            <button key={item} type="button" onClick={() => setScope(item)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-black sm:min-h-11 sm:text-sm ${scope === item ? "border-[#d6b66c] bg-[#d6b66c] text-[#17120a]" : "border-white/10 bg-black/20 text-white/60"}`}>
              {item === "all" ? "ทั้งหมด" : item === "mine" ? "ของฉัน" : "ยังไม่ระบุ"} {counts[item].toLocaleString("th-TH")}
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
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4 sm:py-3">
                <div><p className="font-black text-white">รายการติดตาม</p><p className="text-xs text-white/45">{visible.length.toLocaleString("th-TH")} รายการ · คลิกเพื่อดูรายละเอียด</p></div>
                <span className="rounded-full border border-[#d6b66c]/30 bg-[#d6b66c]/10 px-3 py-1 text-xs font-black text-[#f6df9d]">{editEnabled ? "EDIT ENABLED" : "READ ONLY"}</span>
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
                        <td className="sticky left-[458px] z-20 border-b border-r border-white/8 bg-[#101014] px-3 py-3"><div className="flex items-center gap-1.5"><RddStatusChip record={record} />{record.qaTestRecord === true && <QaBadge />}</div></td>
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
                  <button data-testid="workspace-mobile-card" key={record.id} type="button" onClick={() => setSelectedId(record.id)} className="block min-h-[108px] w-full px-3 py-2.5 text-left active:bg-white/[0.05]">
                    <div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-base font-black text-[#f6df9d]">{record.plate || "ไม่ระบุทะเบียน"}</p><span className="flex items-center gap-1.5"><RddStatusChip record={record} />{record.qaTestRecord === true && <QaBadge />}</span></div>
                    <p className="mt-0.5 truncate text-sm font-bold text-white">{record.customerName || "ไม่ระบุลูกค้า"}</p>
                    <p className="mt-1 truncate text-xs text-white/52">{purchaseTypeForRecord(record)} · นัดส่ง {thaiDate(record.deliveryDate)} · งานค้าง {pendingSummary(record)}</p>
                    {(record.saleName || record.ownerName) && <p className="mt-1 truncate text-xs font-bold text-white/68">{record.saleName || record.ownerName}</p>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selected && <WorkspaceDetail record={selected} revision={revision} editEnabled={editEnabled && user?.role !== "viewer"} onClose={() => setSelectedId("")} onSaved={replaceRecord} />}

      <style jsx>{`
        .workspace-select { min-height: 48px; border-radius: 16px; border: 1px solid rgba(255,255,255,.12); background: #111114; padding: 0 12px; color: white; font-size: 13px; font-weight: 800; min-width: 0; width: 100%; }
        .workspace-select.compact { min-height: 44px; border-radius: 12px; padding: 0 5px; font-size: 11px; }
      `}</style>
    </main>
  );
}

type WorkspaceDraft = {
  purchaseType: "" | RddCanonicalPurchaseType;
  caseStatus: "" | RddCaseStatus;
  deliveryDate: string;
  deliveryTime: string;
  deliveryLocation: string;
  deliveryLocationNote: string;
  financeCaseNote: string;
};

function draftForRecord(record: BookingDeliveryRecord): WorkspaceDraft {
  return {
    purchaseType: record.purchaseType || "",
    caseStatus: record.caseStatus || "",
    deliveryDate: record.deliveryDate || "",
    deliveryTime: record.deliveryTime || "",
    deliveryLocation: record.deliveryLocation || "",
    deliveryLocationNote: record.deliveryLocationNote || "",
    financeCaseNote: record.financeCaseNote || ""
  };
}

function WorkspaceDetail({ record, revision, editEnabled, onClose, onSaved }: {
  record: BookingDeliveryRecord;
  revision: string;
  editEnabled: boolean;
  onClose: () => void;
  onSaved: (record: BookingDeliveryRecord, revision: string) => void;
}) {
  const documents = resolveCaseDocumentManifest(record);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkspaceDraft>(() => draftForRecord(record));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [conflict, setConflict] = useState<{ record: BookingDeliveryRecord; revision: string } | null>(null);
  const original = draftForRecord(record);
  const dirty = (Object.keys(original) as Array<keyof WorkspaceDraft>).some((key) => draft[key] !== original[key]);
  const workflowValid = !draft.purchaseType || !draft.caseStatus ? false : isStatusValidForPurchaseType(draft.purchaseType, draft.caseStatus);
  const workflowTouched = draft.purchaseType !== original.purchaseType || draft.caseStatus !== original.caseStatus;
  const workflowError = workflowTouched && !workflowValid ? "กรุณาเลือกสถานะใหม่ให้ตรงกับประเภทการซื้อ" : "";
  const canEdit = editEnabled && record.qaTestRecord !== true;

  function startEdit() {
    setDraft(draftForRecord(record));
    setMessage("");
    setConflict(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(draftForRecord(record));
    setMessage("");
    setConflict(null);
    setEditing(false);
  }

  function requestClose() {
    if (editing && dirty) setConfirmClose(true);
    else onClose();
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setMessage("");
    setConflict(null);
    const changes: RddWorkspaceChanges = {};
    if (draft.purchaseType !== original.purchaseType && draft.purchaseType) changes.purchaseType = draft.purchaseType;
    if (draft.caseStatus !== original.caseStatus && draft.caseStatus) changes.caseStatus = draft.caseStatus;
    for (const key of ["deliveryDate", "deliveryTime", "deliveryLocation", "deliveryLocationNote", "financeCaseNote"] as const) {
      if (draft[key] !== original[key]) changes[key] = draft[key];
    }
    try {
      const response = await fetch("/api/booking-delivery-workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, expectedRevision: revision, changes })
      });
      const data = await response.json() as { record?: BookingDeliveryRecord; revision?: string; error?: string; warning?: string; current?: { record: BookingDeliveryRecord; revision: string } };
      if (response.status === 409) {
        setConflict(data.current || null);
        setMessage(data.error || "ข้อมูลเคสนี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น");
        return;
      }
      if (!response.ok && response.status !== 207) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      if (!data.record || !data.revision) throw new Error("เซิร์ฟเวอร์ส่งข้อมูลกลับไม่ครบ");
      onSaved(data.record, data.revision);
      setDraft(draftForRecord(data.record));
      setEditing(false);
      setMessage(data.warning || "บันทึกแล้ว");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="workspace-detail-overlay" className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <aside data-testid="workspace-detail-panel" className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-white/10 bg-[#0c0c0f] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d6b66c]">{editing ? "Edit case" : "Case detail"}</p><h2 className="mt-2 text-2xl font-black text-white">{record.plate || "ไม่ระบุทะเบียน"}</h2><p className="mt-1 text-sm text-white/48">{record.customerName || "ไม่ระบุลูกค้า"}</p></div>
          <div className="flex gap-2">{canEdit && !editing && <button data-testid="workspace-edit-button" type="button" onClick={startEdit} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d6b66c]/35 bg-[#d6b66c]/10 px-3 text-sm font-black text-[#f6df9d]"><Pencil size={16} />แก้ไข</button>}<button type="button" aria-label="ปิดรายละเอียด" onClick={requestClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white"><X size={20} /></button></div>
        </div>
        <div className="mt-5 flex items-center gap-2"><RddStatusChip record={record} />{record.qaTestRecord === true && <QaBadge />}</div>
        {record.qaTestRecord === true && <p data-testid="workspace-qa-read-only" className="mt-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/8 px-3 py-2 text-sm font-bold text-fuchsia-100">ข้อมูล TEST/QA เป็นแบบอ่านอย่างเดียว</p>}
        {message && <p role="status" className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${conflict ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-white/75"}`}>{message}</p>}
        {conflict && <button data-testid="workspace-load-latest" type="button" onClick={() => { onSaved(conflict.record, conflict.revision); setDraft(draftForRecord(conflict.record)); setConflict(null); setMessage(""); setEditing(false); }} className="mt-2 min-h-11 rounded-xl border border-amber-300/30 px-3 text-sm font-black text-amber-100">โหลดข้อมูลล่าสุด</button>}
        <DetailGroup title="ลูกค้าและการขาย" items={[["ลูกค้า", record.customerName], ["ประเภทซื้อ", purchaseTypeForRecord(record)], ["เซลล์", record.saleName], ["เจ้าของ", record.ownerName || "ยังไม่ระบุ"]]} />
        <DetailGroup title="รถ" items={[["รถ", [record.brand, record.model, record.year].filter(Boolean).join(" ")], ["สี", record.color], ["เลขเครื่อง", record.engineNo], ["เลขตัวถัง", record.chassisNo]]} />
        <DetailGroup title="Booking" items={[["Booking ID", record.bookingId], ["วันที่จอง", thaiDate(record.bookingDate)], ["ราคาตั้ง", money(record.salePrice)], ["ราคาขาย", money(record.finalPrice)], ["ส่วนลด", money(record.centralDiscount)]]} />
        {editing ? (
          <section data-testid="workspace-edit-fields" className="mt-3 rounded-2xl border border-[#d6b66c]/25 bg-[#d6b66c]/[0.05] p-3 sm:mt-5 sm:p-4">
            <h3 className="font-black text-white">ข้อมูลที่แก้ไขได้</h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block text-xs font-black text-[#d6b66c]">ประเภทซื้อ
                <select data-testid="purchase-type-select" value={draft.purchaseType} onChange={(event) => {
                  const purchaseType = event.target.value as "" | RddCanonicalPurchaseType;
                  setDraft((current) => ({ ...current, purchaseType, caseStatus: isStatusValidForPurchaseType(purchaseType, current.caseStatus) ? current.caseStatus : "" }));
                }} className="mt-1 min-h-11 w-full rounded-xl border border-white/12 bg-[#111114] px-2 text-sm text-white">
                  <option value="">ไม่ระบุ</option>
                  {Object.entries(RDD_PURCHASE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-black text-[#d6b66c]">สถานะ
                <select data-testid="case-status-select" value={draft.caseStatus} disabled={!draft.purchaseType} onChange={(event) => setDraft((current) => ({ ...current, caseStatus: event.target.value as "" | RddCaseStatus }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/12 bg-[#111114] px-2 text-sm text-white disabled:opacity-45">
                  <option value="">เลือกสถานะ</option>
                  {statusesForPurchaseType(draft.purchaseType).map((value) => <option key={value} value={value}>{RDD_CASE_STATUS_LABELS[value]}</option>)}
                </select>
              </label>
            </div>
            {workflowError && <p data-testid="workflow-validation-error" className="mt-2 text-xs font-bold text-amber-200">{workflowError}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block text-xs font-black text-[#d6b66c]">วันนัดส่งมอบ<input aria-label="วันนัดส่งมอบ" type="date" value={draft.deliveryDate} onChange={(event) => setDraft((current) => ({ ...current, deliveryDate: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/12 bg-[#111114] px-2 text-sm text-white" /></label>
              <label className="block text-xs font-black text-[#d6b66c]">เวลานัดส่งมอบ<input aria-label="เวลานัดส่งมอบ" type="time" value={draft.deliveryTime} onChange={(event) => setDraft((current) => ({ ...current, deliveryTime: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/12 bg-[#111114] px-2 text-sm text-white" /></label>
            </div>
            <label className="mt-3 block text-xs font-black text-[#d6b66c]">สถานที่ส่งมอบ
              <select value={draft.deliveryLocation} onChange={(event) => setDraft((current) => ({
                ...current,
                deliveryLocation: event.target.value,
                deliveryLocationNote: event.target.value === "นอกสถานที่" ? current.deliveryLocationNote : original.deliveryLocationNote
              }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/12 bg-[#111114] px-3 text-sm text-white">
                <option value="">ไม่ระบุ / ล้างค่า</option>
                {record.deliveryLocation && !RDD_DELIVERY_LOCATIONS.includes(record.deliveryLocation as typeof RDD_DELIVERY_LOCATIONS[number]) && <option value={record.deliveryLocation}>ค่าเดิม: {record.deliveryLocation}</option>}
                {RDD_DELIVERY_LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}
              </select>
            </label>
            {draft.deliveryLocation === "นอกสถานที่" && <label className="mt-3 block text-xs font-black text-[#d6b66c]">รายละเอียดนอกสถานที่<textarea aria-label="รายละเอียดนอกสถานที่" maxLength={300} value={draft.deliveryLocationNote} onChange={(event) => setDraft((current) => ({ ...current, deliveryLocationNote: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-white/12 bg-[#111114] p-3 text-sm leading-5 text-white outline-none focus:border-[#d6b66c]" /></label>}
            <label className="mt-3 block text-xs font-black text-[#d6b66c]">หมายเหตุไฟแนนซ์<textarea maxLength={1000} value={draft.financeCaseNote} onChange={(event) => setDraft((current) => ({ ...current, financeCaseNote: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-white/12 bg-[#111114] p-3 text-sm leading-5 text-white outline-none focus:border-[#d6b66c]" /></label>
            <p className="mt-1 text-right text-[11px] text-white/35">{draft.financeCaseNote.length}/1,000</p>
          </section>
        ) : <><DetailGroup title="ไฟแนนซ์" items={[["ส่งเคสแล้ว", record.financeCaseSubmitted ? "ใช่" : "—"], ["เวลาส่งเคส", thaiDate(record.financeCaseSubmittedAt, true)], ["หมายเหตุ", record.financeCaseNote || "—"]]} /><DetailGroup title="ส่งมอบและเตรียมรถ" items={[["วันนัดส่ง", thaiDate(record.deliveryDate)], ["เวลานัด", record.deliveryTime], ["สถานที่", record.deliveryLocation], ["รายละเอียดสถานที่", record.deliveryLocation === "นอกสถานที่" ? record.deliveryLocationNote : ""], ["วันรถกลับ", thaiDate(record.garageReturnDate)], ["งานที่ทำแล้ว", prepSummary(record)]]} /></>}
        <section data-testid="case-document-manifest" className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:mt-5 sm:p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-black text-white">เอกสารของเคส</h3><span className="text-xs font-black text-[#f6df9d]">{documents.availableCount}/{documents.totalCount}</span></div>
          <div className="mt-2 divide-y divide-white/8">
            {documents.items.map((item) => <div key={item.kind} className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm"><span className={`flex min-w-0 items-center gap-2 font-bold ${item.available ? "text-white" : "text-white/42"}`}>{item.available ? <Check size={15} className="shrink-0 text-emerald-300" /> : <span className="w-[15px] shrink-0 text-center">—</span>}<span className="truncate">{item.label}</span></span><span className="shrink-0 text-xs text-white/42">{item.available ? item.fileCount ? `${item.fileCount} ไฟล์` : "มีแล้ว" : "ยังไม่มี"}</span></div>)}
          </div>
          <p className="mt-2 text-xs leading-5 text-white/38">แสดงเฉพาะข้อมูลอ้างอิงที่ผูกกับเคสได้จากระบบปัจจุบัน</p>
        </section>
        <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm"><span className="font-black text-white">Activity</span><span className="text-white/45"> · อัปเดตล่าสุด {thaiDate(record.updatedAt, true)} · รายการกิจกรรมรายเคสยังไม่เปิดใน Phase 2</span></section>
        {editing ? <div data-testid="workspace-edit-actions" className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-[#0c0c0f]/95 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur"><button type="button" onClick={cancelEdit} disabled={saving} className="min-h-12 flex-1 rounded-xl border border-white/12 bg-white/5 font-black text-white">ยกเลิก</button><button type="button" onClick={save} disabled={!dirty || saving || Boolean(conflict) || Boolean(workflowError)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#d6b66c] font-black text-[#17120a] disabled:cursor-not-allowed disabled:opacity-40">{saving && <Loader2 size={17} className="animate-spin" />}บันทึก</button></div> : <button type="button" onClick={requestClose} className="mt-5 min-h-12 w-full rounded-xl border border-white/12 bg-white/5 font-black text-white sm:hidden">ปิด</button>}
        {confirmClose && <div data-testid="workspace-dirty-confirmation" className="sticky bottom-2 mt-3 rounded-2xl border border-amber-300/25 bg-[#282014] p-3 shadow-2xl"><div className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-200" /><p className="text-sm font-bold text-amber-50">มีข้อมูลที่ยังไม่ได้บันทึก ต้องการทิ้งการเปลี่ยนแปลงหรือไม่</p></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => setConfirmClose(false)} className="min-h-11 flex-1 rounded-xl border border-white/12 text-sm font-black text-white">กลับไปแก้</button><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl bg-amber-200 text-sm font-black text-[#211809]">ทิ้งการเปลี่ยนแปลง</button></div></div>}
      </aside>
    </div>
  );
}

function QaBadge() {
  return <span data-testid="qa-record-badge" className="rounded-full border border-fuchsia-300/35 bg-fuchsia-300/10 px-2 py-0.5 text-[10px] font-black tracking-wide text-fuchsia-200">TEST/QA</span>;
}

function DetailGroup({ title, items }: { title: string; items: Array<[string, unknown]> }) {
  const meaningful = items.filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "—");
  if (meaningful.length === 0) return <section data-testid="workspace-empty-detail-group" className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm"><span className="font-black text-white">{title}</span><span className="text-white/45"> · ยังไม่มีข้อมูล</span></section>;
  return <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:mt-5 sm:p-4"><h3 className="font-black text-white">{title}</h3><div className="mt-2 grid grid-cols-2 gap-2.5 sm:mt-3 sm:gap-3">{meaningful.map(([label, value]) => <div key={label} className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d6b66c]">{label}</p><p className="mt-0.5 break-words text-sm font-bold text-white">{String(value)}</p></div>)}</div></section>;
}
