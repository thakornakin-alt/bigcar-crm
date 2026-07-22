"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Search,
  X
} from "lucide-react";
import {
  PageContainer,
  PageTitle,
  SearchField,
  SectionCard,
  TopMenuButton
} from "@/app/components/ui";
import {
  bookingDeliveryRecordsToCsv,
  bookingDeliveryRecordsToTsv,
  buildBookingDeliveryView,
  currentBangkokMonth,
  getBangkokMonthRange,
  getBookingDisplayStatus,
  hasUnknownBookingDate,
  hasUnknownHistory,
  parseBusinessDate,
  type BookingDeliveryCountFilter,
  type BookingDeliveryDateFilter
} from "@/lib/booking-delivery-v2";
import type { BookingDeliveryRecord, BookingDeliveryStatus } from "@/lib/types";

const monthNames = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const statusOptions: Array<"all" | BookingDeliveryStatus> = [
  "all", "ยอดจอง", "รอผลไฟแนนซ์", "รอส่งมอบ", "ยอดส่งมอบ", "ยกเลิก"
];

const initialMonth = currentBangkokMonth();

function text(value: unknown) {
  return String(value ?? "").trim();
}

function formatMoney(value: unknown) {
  const numeric = Number(text(value).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) && numeric
    ? new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric)
    : "-";
}

function formatBusinessDate(value: unknown) {
  const parsed = parseBusinessDate(value);
  if (parsed === null) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(parsed));
}

function statusClass(status: BookingDeliveryStatus) {
  if (status === "ยอดส่งมอบ") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-200";
  if (status === "ยกเลิก") return "border-red-400/35 bg-red-400/10 text-red-200";
  if (status === "รอผลไฟแนนซ์") return "border-amber-300/35 bg-amber-300/10 text-amber-100";
  return "border-[#d6b66c]/40 bg-[#d6b66c]/10 text-[#f6df9d]";
}

function downloadText(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.warning || "Request failed");
  return data;
}

export default function BookingDeliveryV2Page() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [year, setYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | BookingDeliveryStatus>("all");
  const [saleName, setSaleName] = useState("");
  const [countFilter, setCountFilter] = useState<BookingDeliveryCountFilter>("all");
  const [dateFilter, setDateFilter] = useState<BookingDeliveryDateFilter>("all_related");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    bookingDate: "",
    workflowStatus: "ยอดจอง" as BookingDeliveryStatus,
    deliveryDate: "",
    isCounted: true
  });

  const range = useMemo(() => getBangkokMonthRange(year, month), [year, month]);
  const monthLabel = `${monthNames[month - 1]} ${year + 543}`;
  const saleOptions = useMemo(
    () => Array.from(new Set(records.map((record) => text(record.saleName)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "th")),
    [records]
  );

  const view = useMemo(() => {
    const result = buildBookingDeliveryView(records, range, {
      query,
      status,
      saleName,
      count: countFilter,
      date: dateFilter
    });
    return {
      ...result,
      records: [...result.records].sort((a, b) => {
        const aDate = parseBusinessDate(a.bookingDate) ?? Number.NEGATIVE_INFINITY;
        const bDate = parseBusinessDate(b.bookingDate) ?? Number.NEGATIVE_INFINITY;
        return bDate - aDate || text(a.bookingId).localeCompare(text(b.bookingId));
      })
    };
  }, [records, range, query, status, saleName, countFilter, dateFilter]);

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) || null,
    [records, selectedId]
  );

  async function loadRecords() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ records: BookingDeliveryRecord[] }>("/api/booking-delivery");
      setRecords(data.records || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลด Booking Delivery Master ไม่สำเร็จ");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      bookingDate: selected.bookingDate || "",
      workflowStatus: getBookingDisplayStatus(selected),
      deliveryDate: selected.deliveryDate || "",
      isCounted: selected.isCounted !== false
    });
  }, [selected]);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ record: BookingDeliveryRecord }>("/api/booking-delivery", {
        method: "PATCH",
        body: JSON.stringify({
          id: selected.id,
          bookingDate: draft.bookingDate,
          status: draft.workflowStatus === "ยกเลิก" ? "ยกเลิก" : undefined,
          workflowStatus: draft.workflowStatus === "ยอดจอง" ? "" : draft.workflowStatus,
          deliveryDate: draft.deliveryDate,
          isCounted: draft.isCounted
        })
      });
      setRecords((current) => current.map((record) => record.id === data.record.id ? data.record : record));
      setMessage("บันทึก Booking Delivery แล้ว");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    downloadText(
      bookingDeliveryRecordsToCsv(view.records),
      `booking-delivery-${range.key}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  async function copyTable() {
    try {
      await navigator.clipboard.writeText(bookingDeliveryRecordsToTsv(view.records));
      setMessage(`คัดลอก ${view.records.length.toLocaleString("th-TH")} รายการแล้ว`);
    } catch {
      setError("เบราว์เซอร์ไม่อนุญาตให้คัดลอกตาราง");
    }
  }

  const summaryCards = [
    ["ยอดยกมา", view.summary.carryIn],
    ["จองใหม่เดือนนี้", view.summary.newBookings],
    ["รวมรายการติดตาม", view.summary.totalTracking],
    ["ส่งมอบเดือนนี้", view.summary.delivered],
    ["ยกเลิกเดือนนี้", view.summary.cancelled],
    ["คงค้างยกไป", view.summary.carryOut],
    ["ข้อมูลเก่าไม่ทราบวันที่", view.summary.unknownDate]
  ] as const;

  return (
    <PageContainer wide>
      <div className="booking-delivery-v2 text-white">
        <div className="no-print">
          <PageTitle
            title="Booking–Delivery"
            subtitle="ติดตามงานจองถึงส่งมอบ"
            actions={
              <>
                <TopMenuButton href="/booking-delivery" icon={<ArrowLeft size={17} />}>หน้าเดิม</TopMenuButton>
                <button
                  type="button"
                  onClick={loadRecords}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d6b66c]/40 bg-[#d6b66c]/10 px-3 text-sm font-black text-[#f6df9d]"
                >
                  {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                  รีเฟรช
                </button>
              </>
            }
          />
        </div>

        <div className="mb-5 hidden print:block">
          <p className="text-sm font-bold">BIG CAR CRM</p>
          <h1 className="text-2xl font-black">รายงาน Booking–Delivery</h1>
          <p>ประจำเดือน {monthLabel}</p>
          <p className="text-xs">พิมพ์เมื่อ {new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date())}</p>
        </div>

        <section className="no-print mb-4 overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(214,182,108,0.18),transparent_35%),linear-gradient(145deg,rgba(20,20,20,0.96),rgba(7,8,10,0.96))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d6b66c]">เดือนที่เลือก</p>
              <p className="mt-1 text-xl font-black text-white">{monthLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => shiftMonth(-1)} className="month-button"><ChevronLeft size={20} /></button>
              <button type="button" aria-label="เดือนถัดไป" onClick={() => shiftMonth(1)} className="month-button"><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
            <label className="filter-label">เดือน
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="filter-select">
                {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
            </label>
            <label className="filter-label">ปี
              <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="filter-select">
                {Array.from({ length: 9 }, (_, index) => initialMonth.year - 5 + index).map((item) => (
                  <option key={item} value={item}>{item + 543}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map(([label, value], index) => (
            <div key={label} className={`rounded-[22px] border p-4 ${index === 3 ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/[0.045]"}`}>
              <p className="text-xs font-bold text-white/60">{label}</p>
              <p className={`mt-2 text-2xl font-black ${index === 3 ? "text-emerald-300" : "text-[#f6df9d]"}`}>{value.toLocaleString("th-TH")}</p>
            </div>
          ))}
        </section>

        <div className="no-print mb-4">
          <SectionCard title="ค้นหาและกรอง" icon={<Search size={18} />}>
            <SearchField
              icon={<Search size={17} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาลูกค้า ทะเบียน รถ เซลล์ ทีม หรือ Booking ID"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="filter-label">สถานะ
                <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="filter-select">
                  {statusOptions.map((item) => <option key={item} value={item}>{item === "all" ? "ทุกสถานะ" : item}</option>)}
                </select>
              </label>
              <label className="filter-label">เซลล์
                <select value={saleName} onChange={(event) => setSaleName(event.target.value)} className="filter-select">
                  <option value="">ทุกเซลล์</option>
                  {saleOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="filter-label">การนับยอด
                <select value={countFilter} onChange={(event) => setCountFilter(event.target.value as BookingDeliveryCountFilter)} className="filter-select">
                  <option value="all">ทั้งหมด</option>
                  <option value="counted">นับยอด</option>
                  <option value="not_counted">ไม่นับยอด</option>
                </select>
              </label>
            </div>
            <label className="filter-label">ช่วงวันที่
              <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as BookingDeliveryDateFilter)} className="filter-select">
                <option value="all_related">ทั้งหมดที่เกี่ยวข้อง</option>
                <option value="selected_month">เดือนที่เลือก (วันที่จองชัดเจน)</option>
                <option value="unknown">ข้อมูลเก่าไม่ทราบวันที่</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              <button type="button" onClick={exportCsv} className="action-button"><Download size={16} />CSV</button>
              <button type="button" onClick={copyTable} className="action-button"><Clipboard size={16} />Copy Table</button>
              <button type="button" onClick={() => window.print()} className="action-button"><Printer size={16} />Print / Save PDF</button>
            </div>
          </SectionCard>
        </div>

        {(error || message) && (
          <div className={`no-print mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${error ? "border-red-400/35 bg-red-400/10 text-red-100" : "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"}`}>
            {error || message}
          </div>
        )}

        <section className="print-report overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="font-black">รายการ Booking–Delivery</h2>
              <p className="text-xs text-white/55">แสดง {view.records.length.toLocaleString("th-TH")} จาก {records.length.toLocaleString("th-TH")} รายการ</p>
            </div>
            {loading && <Loader2 className="animate-spin text-[#d6b66c]" size={20} />}
          </div>

          <div className="hidden overflow-x-auto lg:block print:block">
            <table className="w-full min-w-[940px] border-collapse text-left text-xs">
              <thead className="bg-black/35 text-white/55">
                <tr>{["วันที่จอง", "สถานะ", "ลูกค้า", "ทะเบียน", "รถ", "ราคาขาย", "เซลล์", "วันส่งมอบ", "นับยอด", "Action"].map((item) => <th key={item} className="px-3 py-3 font-black">{item}</th>)}</tr>
              </thead>
              <tbody>
                {view.records.map((record) => <BookingTableRow key={record.id} record={record} onOpen={() => setSelectedId(record.id)} />)}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/10 lg:hidden print:hidden">
            {view.records.map((record) => (
              <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} className="block w-full p-4 text-left transition hover:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{record.customerName || "ไม่ระบุลูกค้า"}</p>
                    <p className="mt-1 text-sm font-bold text-[#f6df9d]">{record.plate || "-"}</p>
                  </div>
                  <StatusBadge record={record} />
                </div>
                <p className="mt-3 text-sm text-white/65">{[record.brand, record.model, record.year].filter(Boolean).join(" ") || "ไม่ระบุรถ"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                  {hasUnknownBookingDate(record) ? <UnknownDateBadge /> : <span>จอง {formatBusinessDate(record.bookingDate)}</span>}
                  <span>เซลล์ {record.saleName || "-"}</span>
                  <span>{record.isCounted === false ? "ไม่นับยอด" : "นับยอด"}</span>
                </div>
              </button>
            ))}
          </div>

          {!loading && view.records.length === 0 && <div className="px-4 py-12 text-center text-sm text-white/50">ไม่พบรายการตามตัวกรอง</div>}
        </section>

        {selected && (
          <DetailPanel
            record={selected}
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSave={saveSelected}
            onClose={() => setSelectedId("")}
          />
        )}
      </div>

      <style jsx global>{`
        .booking-delivery-v2 .month-button { display:inline-flex; min-height:44px; min-width:44px; align-items:center; justify-content:center; border-radius:14px; border:1px solid rgba(214,182,108,.38); background:rgba(214,182,108,.1); color:#f6df9d; }
        .booking-delivery-v2 .filter-label { display:grid; gap:6px; font-size:12px; font-weight:800; color:rgba(255,255,255,.62); }
        .booking-delivery-v2 .filter-select { min-height:44px; width:100%; border-radius:14px; border:1px solid rgba(255,255,255,.1); background:#0b0d11; padding:0 12px; color:white; outline:none; }
        .booking-delivery-v2 .filter-select:focus { border-color:rgba(214,182,108,.7); }
        .booking-delivery-v2 .action-button { display:inline-flex; min-height:42px; align-items:center; gap:7px; border-radius:14px; border:1px solid rgba(214,182,108,.35); background:rgba(214,182,108,.08); padding:0 13px; color:#f6df9d; font-size:13px; font-weight:900; }
        @media print {
          body { background:white !important; color:black !important; }
          body > * { visibility:hidden; }
          .booking-delivery-v2, .booking-delivery-v2 * { visibility:visible; }
          .booking-delivery-v2 { position:absolute; inset:0; color:black !important; }
          .no-print, .no-print * { display:none !important; }
          .print-report { border:1px solid #bbb !important; background:white !important; }
          .print-report table { min-width:0 !important; color:black !important; }
          .print-report th, .print-report td { border-bottom:1px solid #ddd !important; color:black !important; padding:7px !important; }
          .print-report button { display:none !important; }
        }
      `}</style>
    </PageContainer>
  );
}

function BookingTableRow({ record, onOpen }: { record: BookingDeliveryRecord; onOpen: () => void }) {
  return (
    <tr className="border-t border-white/10 align-top hover:bg-white/[0.035]">
      <td className="px-3 py-3">{hasUnknownBookingDate(record) ? <UnknownDateBadge /> : formatBusinessDate(record.bookingDate)}</td>
      <td className="px-3 py-3"><StatusBadge record={record} /></td>
      <td className="px-3 py-3 font-bold">{record.customerName || "-"}</td>
      <td className="px-3 py-3 font-black text-[#f6df9d]">{record.plate || "-"}</td>
      <td className="px-3 py-3 text-white/65">{[record.brand, record.model, record.year].filter(Boolean).join(" ") || "-"}</td>
      <td className="px-3 py-3">{formatMoney(record.finalPrice || record.salePrice)}</td>
      <td className="px-3 py-3">{record.saleName || "-"}</td>
      <td className="px-3 py-3">{formatBusinessDate(record.deliveryDate || record.deliveredAt)}</td>
      <td className="px-3 py-3">{record.isCounted === false ? "ไม่" : "นับ"}</td>
      <td className="no-print px-3 py-3"><button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 font-bold text-white"><Eye size={14} />ดู</button></td>
    </tr>
  );
}

function StatusBadge({ record }: { record: BookingDeliveryRecord }) {
  const status = getBookingDisplayStatus(record);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(status)}`}>{status}</span>;
}

function UnknownDateBadge() {
  return <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-100">ไม่ทราบวันที่จอง</span>;
}

function DetailPanel({
  record,
  draft,
  setDraft,
  saving,
  onSave,
  onClose
}: {
  record: BookingDeliveryRecord;
  draft: { bookingDate: string; workflowStatus: BookingDeliveryStatus; deliveryDate: string; isCounted: boolean };
  setDraft: React.Dispatch<React.SetStateAction<{ bookingDate: string; workflowStatus: BookingDeliveryStatus; deliveryDate: string; isCounted: boolean }>>;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const cancelled = record.status === "ยกเลิก";
  return (
    <div className="no-print fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-white/10 bg-[#08090b] p-4 shadow-2xl sm:max-w-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#d6b66c]">Booking Detail</p>
            <h2 className="mt-2 text-2xl font-black">{record.plate || "ไม่ระบุทะเบียน"}</h2>
            <p className="mt-1 text-sm text-white/55">{record.bookingId}</p>
          </div>
          <button type="button" aria-label="ปิดรายละเอียด" onClick={onClose} className="month-button"><X size={20} /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Info label="ลูกค้า" value={record.customerName} />
          <Info label="สถานะ" value={getBookingDisplayStatus(record)} />
          <Info label="รถ" value={[record.brand, record.model, record.year, record.color].filter(Boolean).join(" ")} wide />
          <Info label="ราคาตั้งขาย" value={formatMoney(record.salePrice)} />
          <Info label="ราคาขาย" value={formatMoney(record.finalPrice)} />
          <Info label="ส่วนลดส่วนกลาง" value={formatMoney(record.centralDiscount)} />
          <Info label="หักเงินจอง" value={formatMoney(record.bookingDeduction)} />
          <Info label="เซลล์ / ทีม" value={[record.saleName, record.teamName].filter(Boolean).join(" / ")} wide />
          <Info label="วันที่ส่งมอบ" value={formatBusinessDate(record.deliveredAt || record.deliveryDate)} />
          <Info label="วันที่ยกเลิก" value={formatBusinessDate(record.cancelledAt)} />
        </div>

        {(hasUnknownBookingDate(record) || hasUnknownHistory(record)) && (
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
            {hasUnknownBookingDate(record) ? "ข้อมูลเก่าไม่ทราบวันที่จอง" : "ประวัติสถานะไม่สมบูรณ์: ไม่มี timestamp ส่งมอบหรือยกเลิก"}
          </div>
        )}

        <section className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <h3 className="font-black text-[#f6df9d]">แก้ไขข้อมูลที่อนุญาต</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">วันที่จอง
              <input type="date" value={draft.bookingDate} onChange={(event) => setDraft((current) => ({ ...current, bookingDate: event.target.value }))} className="filter-select" />
            </label>
            <label className="filter-label">สถานะ
              <select disabled={cancelled} value={draft.workflowStatus} onChange={(event) => setDraft((current) => ({ ...current, workflowStatus: event.target.value as BookingDeliveryStatus }))} className="filter-select disabled:opacity-50">
                {(["ยอดจอง", "รอผลไฟแนนซ์", "รอส่งมอบ", "ยอดส่งมอบ", "ยกเลิก"] as BookingDeliveryStatus[]).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-label">วันที่ส่งมอบ
              <input type="date" value={draft.deliveryDate} onChange={(event) => setDraft((current) => ({ ...current, deliveryDate: event.target.value }))} className="filter-select" />
            </label>
            <label className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-[#0b0d11] px-3 text-sm font-black">
              <span>นับใน KPI</span>
              <input type="checkbox" checked={draft.isCounted} onChange={(event) => setDraft((current) => ({ ...current, isCounted: event.target.checked }))} className="h-5 w-5 accent-[#d6b66c]" />
            </label>
          </div>
          <button type="button" onClick={onSave} disabled={saving} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d6b66c] px-4 font-black text-[#101010] disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}บันทึก
          </button>
        </section>

        <div className="mt-5 grid gap-3">
          <Info label="ไฟแนนซ์" value={[record.financeCaseSubmitted ? "ส่งเคสแล้ว" : "ยังไม่ส่งเคส", record.financeCaseNote].filter(Boolean).join(" · ")} wide />
          <Info label="เตรียมรถ" value={[record.spaFullSystemDone && "สปา", record.oilChangeDone && "น้ำมันเครื่อง", record.decalRemovalDone && "ลอกลาย", record.insuranceDone && "ประกัน"].filter(Boolean).join(" · ") || "ยังไม่มีรายการสำเร็จ"} wide />
          <Info label="สรุป / หมายเหตุ" value={record.alertSummary || record.summary || record.cancelReason || "-"} wide />
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.035] p-3 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d6b66c]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-white">{value || "-"}</p>
    </div>
  );
}
