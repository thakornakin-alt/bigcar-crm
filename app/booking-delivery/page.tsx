"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Search,
  TriangleAlert,
  XCircle
} from "lucide-react";
import {
  FilterChip,
  NativeBadge,
  PageContainer,
  PageTitle,
  SearchField,
  SectionCard,
  TopMenuButton
} from "@/app/components/ui";
import { buildBookingDeliveryAlertSummary } from "@/lib/booking-delivery-alert";
import type { BookingDeliveryRecord, BookingDeliveryStatus } from "@/lib/types";

type StatusFilter = "all" | BookingDeliveryStatus;
type SalesSummaryRow = {
  key: string;
  label: string;
  total: number;
  booking: number;
  finance: number;
  ready: number;
  delivered: number;
  cancelled: number;
};

const statusMeta: Record<BookingDeliveryStatus, { label: string; tone: "brand" | "muted" | "warning" }> = {
  "ยอดจอง": { label: "ยอดจองทั้งหมด", tone: "warning" },
  "รอผลไฟแนนซ์": { label: "รอผลไฟแนนซ์", tone: "warning" },
  "รอส่งมอบ": { label: "รอส่งมอบ", tone: "brand" },
  "ยอดส่งมอบ": { label: "ส่งมอบแล้ว", tone: "muted" },
  "ยกเลิก": { label: "ยกเลิก", tone: "warning" }
};

const statusPickerLabels: Record<BookingDeliveryStatus, string> = {
  "ยอดจอง": "ยอดจองทั้งหมด",
  "รอผลไฟแนนซ์": "รอผลไฟแนนซ์",
  "รอส่งมอบ": "รอส่งมอบ",
  "ยอดส่งมอบ": "ส่งมอบแล้ว",
  "ยกเลิก": "ยกเลิก"
};

const emptyCounts = {
  total: 0,
  booking: 0,
  finance: 0,
  ready: 0,
  delivered: 0,
  cancelled: 0
};

function getDisplayStatus(record: BookingDeliveryRecord) {
  if (record.status === "ยกเลิก") return "ยกเลิก";
  return record.workflowStatus || "ยอดจอง";
}

function isBookingActive(record: BookingDeliveryRecord) {
  return record.status !== "ยกเลิก";
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.warning || "Request failed");
  return data;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function formatMoney(value: string) {
  const numeric = Number(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric) || !numeric) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric);
}

function matchSearch(record: BookingDeliveryRecord, query: string) {
  if (!query) return true;
  const haystack = [
    record.plate,
    record.customerName,
    record.brand,
    record.model,
    record.year,
    record.saleName,
    record.teamName,
    record.summary,
    record.alertSummary,
    record.garageOutDate,
    record.garageReturnDate,
    record.deliveryLocation,
    record.project,
    record.campaign
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function formatDateDisplay(value: string) {
  const raw = text(value);
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsed);
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingDeliveryPage() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryModalDate, setDeliveryModalDate] = useState(todayDateInput());
  const [deliveryModalNote, setDeliveryModalNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    status: "ยอดจอง" as BookingDeliveryStatus,
    deliveryDate: "",
    deliveryCompletedDate: "",
    deliveryLocation: "",
    garageOutDate: "",
    garageReturnDate: "",
    spaFullSystemDone: false,
    oilChangeDone: false,
    decalRemovalDone: false,
    vehicleInspectionDone: false,
    insuranceDone: false,
    insuranceStatus: "ยังไม่เสนอ",
    deliveryNote: "",
    financeCaseSubmitted: false,
    financeCaseSubmittedAt: "",
    financeCaseNote: "",
    financeAttachmentIdsText: "",
    cancelReason: ""
  });

  async function loadRecords() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ records: BookingDeliveryRecord[] }>("/api/booking-delivery");
      const nextRecords = data.records || [];
      setRecords(nextRecords);
      setSelectedId((current) => (current && nextRecords.some((record) => record.id === current) ? current : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลด Booking Delivery ไม่สำเร็จ");
      setRecords([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    const selected = records.find((record) => record.id === selectedId) || null;
    if (!selected) return;
    setDraft({
      status: getDisplayStatus(selected),
      deliveryDate: selected.deliveryDate || "",
      deliveryCompletedDate: selected.deliveryCompletedDate || "",
      deliveryLocation: selected.deliveryLocation || "",
      garageOutDate: selected.garageOutDate || "",
      garageReturnDate: selected.garageReturnDate || "",
      spaFullSystemDone: Boolean(selected.spaFullSystemDone),
      oilChangeDone: Boolean(selected.oilChangeDone),
      decalRemovalDone: Boolean(selected.decalRemovalDone),
      vehicleInspectionDone: Boolean(selected.vehicleInspectionDone),
      insuranceDone: Boolean(selected.insuranceDone),
      insuranceStatus: selected.insuranceStatus || (selected.insuranceDone ? "ทำกับเรา" : "ยังไม่เสนอ"),
      deliveryNote: selected.deliveryNote || "",
      financeCaseSubmitted: Boolean(selected.financeCaseSubmitted),
      financeCaseSubmittedAt: selected.financeCaseSubmittedAt || "",
      financeCaseNote: selected.financeCaseNote || "",
      financeAttachmentIdsText: Array.isArray(selected.financeAttachmentIds) ? selected.financeAttachmentIds.join("\n") : "",
      cancelReason: selected.cancelReason || ""
    });
  }, [records, selectedId]);

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc.total += 1;
        if (isBookingActive(record)) acc.booking += 1;
        if (getDisplayStatus(record) === "รอผลไฟแนนซ์") acc.finance += 1;
        if (getDisplayStatus(record) === "รอส่งมอบ") acc.ready += 1;
        if (getDisplayStatus(record) === "ยอดส่งมอบ") acc.delivered += 1;
        if (record.status === "ยกเลิก") acc.cancelled += 1;
        return acc;
      },
      { ...emptyCounts }
    );
  }, [records]);

  const salesSummary = useMemo<SalesSummaryRow[]>(() => {
    const groups = new Map<string, SalesSummaryRow>();
    for (const record of records) {
      const key = text(record.saleName || record.teamName || "ไม่ระบุ");
      const label = key || "ไม่ระบุ";
      const current =
        groups.get(key) || {
          key,
          label,
          total: 0,
          booking: 0,
          finance: 0,
          ready: 0,
          delivered: 0,
          cancelled: 0
        };
      current.total += 1;
      if (isBookingActive(record)) current.booking += 1;
      if (getDisplayStatus(record) === "รอผลไฟแนนซ์") current.finance += 1;
      if (getDisplayStatus(record) === "รอส่งมอบ") current.ready += 1;
      if (getDisplayStatus(record) === "ยอดส่งมอบ") current.delivered += 1;
      if (record.status === "ยกเลิก") current.cancelled += 1;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "th"));
  }, [records]);

  const visibleRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (filter === "all") return true;
        if (filter === "ยอดจอง") return isBookingActive(record);
        return getDisplayStatus(record) === filter;
      })
      .filter((record) => matchSearch(record, query))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }, [records, filter, query]);

  const selectedRecord = useMemo(
    () => (selectedId ? records.find((record) => record.id === selectedId) || null : null),
    [records, selectedId]
  );

  const selectedDisplayStatus = useMemo(() => (selectedRecord ? getDisplayStatus(selectedRecord) : "ยอดจอง"), [selectedRecord]);

  const showFinanceFlow = useMemo(() => {
    if (!selectedRecord) return false;
    const paymentSource = text(
      selectedRecord.paymentType ||
        selectedRecord.workflowStatus ||
        selectedRecord.summary ||
        selectedRecord.alertSummary
    ).toLowerCase();
    const financeHints =
      Boolean(selectedRecord.financeCaseSubmitted) ||
      Boolean(selectedRecord.financeCaseSubmittedAt) ||
      Boolean(selectedRecord.financeCaseNote) ||
      (Array.isArray(selectedRecord.financeAttachmentIds) && selectedRecord.financeAttachmentIds.length > 0);
    if (paymentSource.includes("cash") || paymentSource.includes("สด") || paymentSource.includes("ซื้อสด")) return financeHints;
    if (paymentSource.includes("finance") || paymentSource.includes("ไฟแนนซ์")) return true;
    return financeHints;
  }, [selectedRecord]);

  const alertPreview = useMemo(() => {
    if (!selectedRecord) return "";
    return buildBookingDeliveryAlertSummary({
      ...selectedRecord,
      status: draft.status === "ยกเลิก" ? "ยกเลิก" : (draft.status || selectedDisplayStatus),
      deliveryDate: draft.deliveryDate,
      deliveryCompletedDate: draft.deliveryCompletedDate,
      deliveryLocation: draft.deliveryLocation,
      garageOutDate: draft.garageOutDate,
      garageReturnDate: draft.garageReturnDate,
      spaFullSystemDone: draft.spaFullSystemDone,
      oilChangeDone: draft.oilChangeDone,
      decalRemovalDone: draft.decalRemovalDone,
      vehicleInspectionDone: draft.vehicleInspectionDone,
      insuranceDone: draft.insuranceDone,
      insuranceStatus: draft.insuranceStatus,
      deliveryNote: draft.deliveryNote
    });
  }, [selectedRecord, draft, selectedDisplayStatus]);

  async function saveSelected() {
    if (!selectedRecord) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const financeAttachmentIds = draft.financeAttachmentIdsText
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);
      const data = await api<{ record: BookingDeliveryRecord }>("/api/booking-delivery", {
        method: "PATCH",
        body: JSON.stringify({
          id: selectedRecord.id,
          status: draft.status === "ยกเลิก" ? "ยกเลิก" : undefined,
          workflowStatus: draft.status === "ยอดจอง" ? "" : draft.status,
          deliveryDate: draft.deliveryDate,
          deliveryCompletedDate: draft.deliveryCompletedDate,
          deliveryLocation: draft.deliveryLocation,
          garageOutDate: draft.garageOutDate,
          garageReturnDate: draft.garageReturnDate,
          spaFullSystemDone: draft.spaFullSystemDone,
          oilChangeDone: draft.oilChangeDone,
          decalRemovalDone: draft.decalRemovalDone,
          vehicleInspectionDone: draft.vehicleInspectionDone,
          insuranceDone: draft.insuranceDone,
          insuranceStatus: draft.insuranceStatus,
          deliveryNote: draft.deliveryNote,
          financeCaseSubmitted: draft.financeCaseSubmitted,
          financeCaseSubmittedAt: draft.financeCaseSubmittedAt,
          financeCaseNote: draft.financeCaseNote,
          financeAttachmentIds,
          alertSummary: alertPreview,
          cancelReason: draft.cancelReason
        })
      });
      setRecords((current) => current.map((record) => (record.id === data.record.id ? data.record : record)));
      setSelectedId(data.record.id);
      setMessage("บันทึก Booking Delivery แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึก Booking Delivery ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelivery() {
    if (!selectedRecord) return;
    setDelivering(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ record: BookingDeliveryRecord }>("/api/booking-delivery", {
        method: "PATCH",
        body: JSON.stringify({
          id: selectedRecord.id,
          status: "ส่งมอบแล้ว",
          workflowStatus: "ยอดส่งมอบ",
          deliveryCompletedDate: deliveryModalDate,
          deliveryNote: deliveryModalNote,
          alertSummary: deliveryModalNote || "ส่งมอบแล้ว"
        })
      });
      setRecords((current) => current.map((record) => (record.id === data.record.id ? data.record : record)));
      setSelectedId(data.record.id);
      setDraft((current) => ({
        ...current,
        status: "ยอดส่งมอบ",
        deliveryCompletedDate: deliveryModalDate,
        deliveryNote: deliveryModalNote
      }));
      setDeliveryModalOpen(false);
      setMessage("ยืนยันส่งมอบเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยันส่งมอบไม่สำเร็จ");
    } finally {
      setDelivering(false);
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="Booking Delivery"
        subtitle="ยอดจองทั้งหมด, รอผลไฟแนนซ์, รอส่งมอบ, ส่งมอบแล้ว และยกเลิก รวมไว้ในที่เดียว"
        actions={
          <>
            <button
              type="button"
              onClick={loadRecords}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-bold text-white"
            >
              {loading ? <Loader2 size={17} className="animate-spin text-brand" /> : <RefreshCw size={17} className="text-brand" />}
              Refresh
            </button>
            <TopMenuButton href="/dashboard" icon={<CalendarDays size={18} />} variant="primary">
              Dashboard
            </TopMenuButton>
          </>
        }
      />

      {message && <div className="mb-4 rounded-lg border border-emerald-300/40 bg-emerald-950/30 px-4 py-3 text-sm font-bold text-emerald-100">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{error}</div>}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ยอดจองทั้งหมด" value={`${counts.total.toLocaleString("th-TH")} คัน`} icon={<ClipboardCheck size={18} />} />
        <StatCard label="รอผลไฟแนนซ์" value={`${counts.finance.toLocaleString("th-TH")} คัน`} icon={<ClipboardCheck size={18} />} />
        <StatCard label="รอส่งมอบ" value={`${counts.ready.toLocaleString("th-TH")} คัน`} icon={<ClipboardCheck size={18} />} />
        <StatCard label="ส่งมอบแล้ว" value={`${counts.delivered.toLocaleString("th-TH")} คัน`} icon={<CheckCircle2 size={18} />} tone="muted" />
      </section>

      <SectionCard title="Mini Sales Summary" icon={<ClipboardCheck size={18} />} className="mb-4">
        {salesSummary.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {salesSummary.map((row) => (
              <div key={row.key || row.label} className="rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{row.label}</p>
                    <p className="mt-1 text-xs text-soft">รวม {row.total.toLocaleString("th-TH")} คัน</p>
                  </div>
                  <NativeBadge tone={row.booking ? "warning" : "muted"}>{row.booking ? "ยอดจองทั้งหมด" : "ปกติ"}</NativeBadge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-soft">
                  <MiniStat label="ยอดจองทั้งหมด" value={row.booking} />
                  <MiniStat label="รอผลไฟแนนซ์" value={row.finance} />
                  <MiniStat label="รอส่งมอบ" value={row.ready} />
                  <MiniStat label="ส่งมอบแล้ว" value={row.delivered} />
                  <MiniStat label="ยกเลิก" value={row.cancelled} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-white/10 bg-[#0b0d11] px-4 py-8 text-center text-soft">
            ยังไม่มีข้อมูล Booking Delivery
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="ค้นหาและกรอง" icon={<Search size={18} />}>
          <SearchField
            icon={<Search size={18} />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาทะเบียน / ลูกค้า / เซลล์ / ทีม"
          />

          <div className="flex flex-wrap gap-2">
            {(["ยอดจอง", "รอผลไฟแนนซ์", "รอส่งมอบ", "ยอดส่งมอบ", "ยกเลิก"] as BookingDeliveryStatus[]).map((status) => (
              <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
                {statusPickerLabels[status]}
              </FilterChip>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
              <Loader2 size={22} className="mr-2 animate-spin text-brand" />
              Loading
            </div>
          ) : visibleRecords.length ? (
            <div className="grid gap-3">
              {visibleRecords.map((record) => {
                const active = record.id === selectedId;
                const displayStatus = getDisplayStatus(record);
                const meta = statusMeta[displayStatus as BookingDeliveryStatus] || statusMeta["ยอดจอง"];
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedId(record.id)}
                    className={`text-left rounded-[22px] border p-4 transition ${
                      active ? "border-brand bg-brand/10 shadow-[0_16px_38px_rgba(34,197,94,0.12)]" : "border-white/10 bg-[#0b0d11] hover:border-brand/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black text-white">{record.plate || "-"}</p>
                          <NativeBadge tone={meta.tone}>{meta.label}</NativeBadge>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-soft">{record.customerName || "-"}</p>
                        <p className="mt-1 text-xs text-soft">{record.brand} {record.model} {record.year}</p>
                      </div>
                      <span className="rounded-full border border-line bg-[#11141a] px-3 py-1 text-xs font-black text-soft">
                        {formatDateDisplay(record.deliveryDate || record.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-soft">{record.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-soft">
                        {record.saleName || "-"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-soft">
                        {record.teamName || "-"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
              ยังไม่พบ Booking Delivery ตามเงื่อนไขที่เลือก
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="รายละเอียดงาน"
          icon={<AlertCircle size={18} />}
          className="hidden lg:block lg:sticky lg:top-4"
        >
          {selectedRecord ? (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xl font-black text-white">{selectedRecord.plate || "-"}</p>
                    <p className="mt-1 text-sm text-soft">{selectedRecord.customerName || "-"}</p>
                  </div>
                  <NativeBadge tone={statusMeta[selectedDisplayStatus as BookingDeliveryStatus].tone}>
                    {statusMeta[selectedDisplayStatus as BookingDeliveryStatus]?.label || selectedDisplayStatus}
                  </NativeBadge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="รุ่นรถ" value={[selectedRecord.brand, selectedRecord.model, selectedRecord.year].filter(Boolean).join(" ") || "-"} />
                  <InfoRow label="สี" value={selectedRecord.color || "-"} />
                  <InfoRow label="เลขเครื่อง" value={selectedRecord.engineNo || "-"} />
                  <InfoRow label="เลขตัวถัง" value={selectedRecord.chassisNo || "-"} />
                  <InfoRow label="เซลล์ / ทีม" value={[selectedRecord.saleName, selectedRecord.teamName].filter(Boolean).join(" / ") || "-"} />
                  <InfoRow label="สถานะต้นทาง" value={selectedRecord.statusSource === "manual" ? "แก้เอง" : "อัตโนมัติ"} />
                  <InfoRow label="ราคาจอง" value={formatMoney(selectedRecord.bookingPrice)} />
                  <InfoRow label="ราคาขาย" value={formatMoney(selectedRecord.finalPrice || selectedRecord.salePrice)} />
                </div>
              </div>

              <div className="grid gap-3 rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand">งานเตรียมส่งมอบ</p>
                  <NativeBadge tone={statusMeta[selectedDisplayStatus as BookingDeliveryStatus].tone}>
                    {statusMeta[selectedDisplayStatus as BookingDeliveryStatus]?.label || selectedDisplayStatus}
                  </NativeBadge>
                </div>

                <label className="grid gap-2 text-sm font-bold text-white">
                  สถานะ
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as BookingDeliveryStatus }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                  >
                    {(["ยอดจอง", "รอผลไฟแนนซ์", "รอส่งมอบ", "ยอดส่งมอบ", "ยกเลิก"] as BookingDeliveryStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {statusPickerLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold text-white">
                  นัดส่งมอบ
                  <input
                    value={draft.deliveryDate}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryDate: event.target.value }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    placeholder="วว/ดด/ปปปป"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-white">
                  หมายเหตุงานส่งมอบ
                  <textarea
                    value={draft.deliveryNote}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryNote: event.target.value }))}
                    className="min-h-24 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                    placeholder="รอเอกสาร, รอประกัน, ลูกค้านัดรับวันไหน"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-white">
                  สถานที่ส่งมอบ
                  <input
                    value={draft.deliveryLocation}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryLocation: event.target.value }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    placeholder="เช่น สาขา / จุดส่งมอบ"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-white">
                    วันส่งอู่
                    <input
                      type="date"
                      value={draft.garageOutDate}
                      onChange={(event) => setDraft((current) => ({ ...current, garageOutDate: event.target.value }))}
                      className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-white">
                    วันรถกลับ
                    <input
                      type="date"
                      value={draft.garageReturnDate}
                      onChange={(event) => setDraft((current) => ({ ...current, garageReturnDate: event.target.value }))}
                      className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    />
                  </label>
                  {[
                    ["spaFullSystemDone", "สปาเต็มระบบ"],
                    ["oilChangeDone", "น้ำมันเครื่อง"],
                    ["decalRemovalDone", "ลอกลาย"],
                    ["vehicleInspectionDone", "ตรวจสภาพรถ"]
                  ].map(([key, label]) => (
                    <label key={key} className="flex min-h-12 items-center justify-between rounded-2xl border border-white/10 bg-[#080c12] px-4 text-sm font-bold text-white">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(draft[key as keyof typeof draft])}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, [key]: event.target.checked } as typeof current))
                        }
                        className="h-4 w-4 accent-brand"
                      />
                    </label>
                  ))}
                  <label className="grid gap-2 text-sm font-bold text-white sm:col-span-2">
                    ประกัน
                    <select
                      value={draft.insuranceStatus}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          insuranceStatus: event.target.value,
                          insuranceDone: event.target.value === "ทำกับเรา"
                        }))
                      }
                      className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    >
                      <option value="ยังไม่เสนอ">ยังไม่เสนอ</option>
                      <option value="ทำกับเรา">ทำกับเรา</option>
                      <option value="ทำเอง">ทำเอง</option>
                    </select>
                  </label>
                </div>

                {showFinanceFlow ? (
                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-soft">Finance Flow</p>
                    <label className="flex min-h-12 items-center justify-between rounded-2xl border border-white/10 bg-[#080c12] px-4 text-sm font-bold text-white">
                      <span>ส่งเคสไฟแนนซ์แล้ว</span>
                      <input
                        type="checkbox"
                        checked={draft.financeCaseSubmitted}
                        onChange={(event) => setDraft((current) => ({ ...current, financeCaseSubmitted: event.target.checked }))}
                        className="h-4 w-4 accent-brand"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      เวลาส่งเคสไฟแนนซ์
                      <input
                        type="datetime-local"
                        value={draft.financeCaseSubmittedAt}
                        onChange={(event) => setDraft((current) => ({ ...current, financeCaseSubmittedAt: event.target.value }))}
                        className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      หมายเหตุไฟแนนซ์
                      <textarea
                        value={draft.financeCaseNote}
                        onChange={(event) => setDraft((current) => ({ ...current, financeCaseNote: event.target.value }))}
                        className="min-h-20 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                        placeholder="รายละเอียดเคสไฟแนนซ์"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      แนบไฟล์ไฟแนนซ์ (fileId ต่อบรรทัด)
                      <textarea
                        value={draft.financeAttachmentIdsText}
                        onChange={(event) => setDraft((current) => ({ ...current, financeAttachmentIdsText: event.target.value }))}
                        className="min-h-20 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                        placeholder="fileId1\nfileId2"
                      />
                    </label>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand">Alert Rules</p>
                  <p className="mt-2 text-sm leading-6 text-white">{alertPreview || selectedRecord.alertSummary || selectedRecord.summary || "-"}</p>
                  <p className="mt-1 text-xs text-soft">ระบบจะอัปเดตจากวันส่งอู่ รถกลับ และงานเตรียมรถที่ยังไม่ครบ</p>
                </div>

                  {draft.status === "ยกเลิก" && (
                  <label className="grid gap-2 text-sm font-bold text-white">
                    เหตุผลยกเลิก
                    <textarea
                      value={draft.cancelReason}
                      onChange={(event) => setDraft((current) => ({ ...current, cancelReason: event.target.value }))}
                      className="min-h-20 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                      placeholder="ระบุเหตุผลยกเลิก"
                    />
                  </label>
                )}

                <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-soft">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.status === "ยอดจอง" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, status: "รอผลไฟแนนซ์" }))}
                          className="inline-flex min-h-11 items-center rounded-2xl border border-amber-300/40 bg-amber-300/10 px-3 text-sm font-black text-amber-100"
                        >
                          ไป รอผลไฟแนนซ์
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, status: "รอส่งมอบ" }))}
                          className="inline-flex min-h-11 items-center rounded-2xl border border-brand/40 bg-brand/10 px-3 text-sm font-black text-brand"
                        >
                          ไป รอส่งมอบ
                        </button>
                      </>
                    )}
                    {draft.status === "รอผลไฟแนนซ์" && (
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, status: "รอส่งมอบ" }))}
                        className="inline-flex min-h-11 items-center rounded-2xl border border-brand/40 bg-brand/10 px-3 text-sm font-black text-brand"
                      >
                        อนุมัติแล้ว
                      </button>
                    )}
                    {draft.status === "รอส่งมอบ" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryModalDate(todayDateInput());
                          setDeliveryModalNote(text(draft.deliveryNote || selectedRecord.deliveryNote || ""));
                          setDeliveryModalOpen(true);
                        }}
                        className="inline-flex min-h-11 items-center rounded-2xl border border-brand/40 bg-brand/10 px-3 text-sm font-black text-brand"
                      >
                        ส่งมอบแล้ว
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveSelected}
                  disabled={saving}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-brand bg-brand px-4 text-sm font-black text-ink transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 size={17} className="animate-spin" /> : <ClipboardCheck size={17} />}
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-red-400/40 bg-red-950/20 px-4 text-sm font-black text-red-100 transition hover:border-red-300"
                >
                  <XCircle size={17} />
                  ปิด
                </button>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <p className="text-sm font-bold text-soft">สรุป</p>
                <p className="mt-2 text-sm leading-6 text-white">{alertPreview || selectedRecord.alertSummary || selectedRecord.summary || "-"}</p>
                <p className="mt-2 text-xs text-soft">สร้างเมื่อ {formatDateDisplay(selectedRecord.createdAt)} · อัปเดต {formatDateDisplay(selectedRecord.updatedAt)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
              ไม่มีรายการให้แสดง
            </div>
          )}
        </SectionCard>
      </div>

      {selectedRecord ? (
        <div className="fixed inset-0 z-40 bg-black/10 lg:hidden" aria-hidden="true" />
      ) : null}

      {selectedRecord ? (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
          <SectionCard title="รายละเอียดงาน" icon={<AlertCircle size={18} />} className="max-h-[82vh] overflow-y-auto rounded-t-[28px] border-t border-white/10">
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xl font-black text-white">{selectedRecord.plate || "-"}</p>
                    <p className="mt-1 text-sm text-soft">{selectedRecord.customerName || "-"}</p>
                  </div>
                  <NativeBadge tone={statusMeta[selectedDisplayStatus as BookingDeliveryStatus].tone}>
                    {statusMeta[selectedDisplayStatus as BookingDeliveryStatus]?.label || selectedDisplayStatus}
                  </NativeBadge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="รุ่นรถ" value={[selectedRecord.brand, selectedRecord.model, selectedRecord.year].filter(Boolean).join(" ") || "-"} />
                  <InfoRow label="สี" value={selectedRecord.color || "-"} />
                  <InfoRow label="เลขเครื่อง" value={selectedRecord.engineNo || "-"} />
                  <InfoRow label="เลขตัวถัง" value={selectedRecord.chassisNo || "-"} />
                  <InfoRow label="เซลล์ / ทีม" value={[selectedRecord.saleName, selectedRecord.teamName].filter(Boolean).join(" / ") || "-"} />
                  <InfoRow label="สถานะต้นทาง" value={selectedRecord.statusSource === "manual" ? "แก้เอง" : "อัตโนมัติ"} />
                  <InfoRow label="ราคาจอง" value={formatMoney(selectedRecord.bookingPrice)} />
                  <InfoRow label="ราคาขาย" value={formatMoney(selectedRecord.finalPrice || selectedRecord.salePrice)} />
                </div>
              </div>

              <div className="grid gap-3 rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand">งานเตรียมส่งมอบ</p>
                  <NativeBadge tone={statusMeta[selectedDisplayStatus as BookingDeliveryStatus].tone}>
                    {statusMeta[selectedDisplayStatus as BookingDeliveryStatus]?.label || selectedDisplayStatus}
                  </NativeBadge>
                </div>
                <label className="grid gap-2 text-sm font-bold text-white">
                  สถานะ
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as BookingDeliveryStatus }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                  >
                    {(["ยอดจอง", "รอผลไฟแนนซ์", "รอส่งมอบ", "ยอดส่งมอบ", "ยกเลิก"] as BookingDeliveryStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {statusPickerLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-white">
                  นัดส่งมอบ
                  <input
                    value={draft.deliveryDate}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryDate: event.target.value }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    placeholder="วว/ดด/ปปปป"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-white">
                  หมายเหตุงานส่งมอบ
                  <textarea
                    value={draft.deliveryNote}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryNote: event.target.value }))}
                    className="min-h-24 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                    placeholder="รอเอกสาร, รอประกัน, ลูกค้านัดรับวันไหน"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-white">
                  สถานที่ส่งมอบ
                  <input
                    value={draft.deliveryLocation}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryLocation: event.target.value }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    placeholder="เช่น สาขา / จุดส่งมอบ"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-white">
                    วันส่งอู่
                    <input
                      type="date"
                      value={draft.garageOutDate}
                      onChange={(event) => setDraft((current) => ({ ...current, garageOutDate: event.target.value }))}
                      className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-white">
                    วันรถกลับ
                    <input
                      type="date"
                      value={draft.garageReturnDate}
                      onChange={(event) => setDraft((current) => ({ ...current, garageReturnDate: event.target.value }))}
                      className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    />
                  </label>
                  {[
                    ["spaFullSystemDone", "สปาเต็มระบบ"],
                    ["oilChangeDone", "น้ำมันเครื่อง"],
                    ["decalRemovalDone", "ลอกลาย"],
                    ["vehicleInspectionDone", "ตรวจสภาพรถ"]
                  ].map(([key, label]) => (
                    <label key={key} className="flex min-h-12 items-center justify-between rounded-2xl border border-white/10 bg-[#080c12] px-4 text-sm font-bold text-white">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(draft[key as keyof typeof draft])}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, [key]: event.target.checked } as typeof current))
                        }
                        className="h-4 w-4 accent-brand"
                      />
                    </label>
                  ))}
                  <label className="grid gap-2 text-sm font-bold text-white sm:col-span-2">
                    ประกัน
                    <select
                      value={draft.insuranceStatus}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          insuranceStatus: event.target.value,
                          insuranceDone: event.target.value === "ทำกับเรา"
                        }))
                      }
                      className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    >
                      <option value="ยังไม่เสนอ">ยังไม่เสนอ</option>
                      <option value="ทำกับเรา">ทำกับเรา</option>
                      <option value="ทำเอง">ทำเอง</option>
                    </select>
                  </label>
                </div>
                {showFinanceFlow ? (
                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-soft">Finance Flow</p>
                    <label className="flex min-h-12 items-center justify-between rounded-2xl border border-white/10 bg-[#080c12] px-4 text-sm font-bold text-white">
                      <span>ส่งเคสไฟแนนซ์แล้ว</span>
                      <input
                        type="checkbox"
                        checked={draft.financeCaseSubmitted}
                        onChange={(event) => setDraft((current) => ({ ...current, financeCaseSubmitted: event.target.checked }))}
                        className="h-4 w-4 accent-brand"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      เวลาส่งเคสไฟแนนซ์
                      <input
                        type="datetime-local"
                        value={draft.financeCaseSubmittedAt}
                        onChange={(event) => setDraft((current) => ({ ...current, financeCaseSubmittedAt: event.target.value }))}
                        className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      หมายเหตุไฟแนนซ์
                      <textarea
                        value={draft.financeCaseNote}
                        onChange={(event) => setDraft((current) => ({ ...current, financeCaseNote: event.target.value }))}
                        className="min-h-20 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                        placeholder="รายละเอียดเคสไฟแนนซ์"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      แนบไฟล์ไฟแนนซ์ (fileId ต่อบรรทัด)
                      <textarea
                        value={draft.financeAttachmentIdsText}
                        onChange={(event) => setDraft((current) => ({ ...current, financeAttachmentIdsText: event.target.value }))}
                        className="min-h-20 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                        placeholder="fileId1\nfileId2"
                      />
                    </label>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand">Alert Rules</p>
                  <p className="mt-2 text-sm leading-6 text-white">{alertPreview || selectedRecord.alertSummary || selectedRecord.summary || "-"}</p>
                  <p className="mt-1 text-xs text-soft">ระบบจะอัปเดตจากวันส่งอู่ รถกลับ และงานเตรียมรถที่ยังไม่ครบ</p>
                </div>
                <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-soft">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.status === "ยอดจอง" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, status: "รอผลไฟแนนซ์" }))}
                          className="inline-flex min-h-11 items-center rounded-2xl border border-amber-300/40 bg-amber-300/10 px-3 text-sm font-black text-amber-100"
                        >
                          ไป รอผลไฟแนนซ์
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, status: "รอส่งมอบ" }))}
                          className="inline-flex min-h-11 items-center rounded-2xl border border-brand/40 bg-brand/10 px-3 text-sm font-black text-brand"
                        >
                          ไป รอส่งมอบ
                        </button>
                      </>
                    )}
                    {draft.status === "รอผลไฟแนนซ์" && (
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, status: "รอส่งมอบ" }))}
                        className="inline-flex min-h-11 items-center rounded-2xl border border-brand/40 bg-brand/10 px-3 text-sm font-black text-brand"
                      >
                        อนุมัติแล้ว
                      </button>
                    )}
                    {draft.status === "รอส่งมอบ" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryModalDate(todayDateInput());
                          setDeliveryModalNote(text(draft.deliveryNote || selectedRecord.deliveryNote || ""));
                          setDeliveryModalOpen(true);
                        }}
                        className="inline-flex min-h-11 items-center rounded-2xl border border-brand/40 bg-brand/10 px-3 text-sm font-black text-brand"
                      >
                        ส่งมอบแล้ว
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/40 bg-red-950/20 px-4 text-sm font-black text-red-100 transition hover:border-red-300"
                >
                  <XCircle size={17} />
                  ปิด
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {deliveryModalOpen && selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#080c12] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">ยืนยันส่งมอบรถ</p>
                <p className="mt-1 text-sm text-soft">{selectedRecord.plate || "-"} · {selectedRecord.customerName || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-soft transition hover:border-white/20 hover:text-white"
                aria-label="ปิด"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-white">
                วันรับรถจริง
                <input
                  type="date"
                  value={deliveryModalDate}
                  onChange={(event) => setDeliveryModalDate(event.target.value)}
                  className="min-h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-white outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-white">
                หมายเหตุส่งมอบ
                <textarea
                  value={deliveryModalNote}
                  onChange={(event) => setDeliveryModalNote(event.target.value)}
                  className="min-h-24 rounded-2xl border border-white/10 bg-[#0f141b] px-4 py-3 text-white outline-none"
                  placeholder="ตัวอย่าง: รอเอกสาร / นัดลูกค้ารับ"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeliveryModalOpen(false)}
                className="inline-flex min-h-12 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelivery}
                disabled={delivering}
                className="inline-flex min-h-12 items-center rounded-2xl border border-brand bg-brand px-4 text-sm font-black text-ink transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {delivering ? "กำลังบันทึก..." : "ยืนยันส่งมอบ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "brand"
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "brand" | "muted" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
      : tone === "muted"
        ? "border-line bg-[#0b0d11] text-soft"
        : "border-brand/25 bg-brand/10 text-brand";

  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,32,0.92),rgba(7,10,15,0.94))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-soft">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#11151d] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#11151d] px-3 py-2">
      <p className="text-[11px] text-soft">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
