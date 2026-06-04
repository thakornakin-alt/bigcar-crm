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
import type { BookingDeliveryRecord, BookingDeliveryStatus } from "@/lib/types";

type StatusFilter = "all" | BookingDeliveryStatus;

const statusMeta: Record<BookingDeliveryStatus, { label: string; tone: "brand" | "muted" | "warning" }> = {
  "ติดจองรอคอนเฟิร์ม": { label: "ติดจองรอคอนเฟิร์ม", tone: "warning" },
  "พร้อมส่งมอบ": { label: "พร้อมส่งมอบ", tone: "brand" },
  "ส่งมอบแล้ว": { label: "ส่งมอบแล้ว", tone: "muted" },
  "ยกเลิก": { label: "ยกเลิก", tone: "warning" }
};

const emptyCounts = {
  total: 0,
  pending: 0,
  ready: 0,
  delivered: 0,
  cancelled: 0
};

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

export default function BookingDeliveryPage() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    status: "ติดจองรอคอนเฟิร์ม" as BookingDeliveryStatus,
    deliveryDate: "",
    deliveryLocation: "",
    alertSummary: "",
    cancelReason: ""
  });

  async function loadRecords() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ records: BookingDeliveryRecord[] }>("/api/booking-delivery");
      const nextRecords = data.records || [];
      setRecords(nextRecords);
      setSelectedId((current) => current || nextRecords[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลด Booking Delivery ไม่สำเร็จ");
      setRecords([]);
      setSelectedId("");
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
      status: selected.status,
      deliveryDate: selected.deliveryDate || "",
      deliveryLocation: selected.deliveryLocation || "",
      alertSummary: selected.alertSummary || "",
      cancelReason: selected.cancelReason || ""
    });
  }, [records, selectedId]);

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "ติดจองรอคอนเฟิร์ม") acc.pending += 1;
        if (record.status === "พร้อมส่งมอบ") acc.ready += 1;
        if (record.status === "ส่งมอบแล้ว") acc.delivered += 1;
        if (record.status === "ยกเลิก") acc.cancelled += 1;
        return acc;
      },
      { ...emptyCounts }
    );
  }, [records]);

  const visibleRecords = useMemo(() => {
    return records
      .filter((record) => (filter === "all" ? true : record.status === filter))
      .filter((record) => matchSearch(record, query))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }, [records, filter, query]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) || visibleRecords[0] || null,
    [records, selectedId, visibleRecords]
  );

  async function saveSelected() {
    if (!selectedRecord) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await api<{ record: BookingDeliveryRecord }>("/api/booking-delivery", {
        method: "PATCH",
        body: JSON.stringify({
          id: selectedRecord.id,
          status: draft.status,
          deliveryDate: draft.deliveryDate,
          deliveryLocation: draft.deliveryLocation,
          alertSummary: draft.alertSummary,
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

  return (
    <PageContainer wide>
      <PageTitle
        title="Booking Delivery"
        subtitle="ติดจอง, พร้อมส่งมอบ, ส่งมอบแล้ว และยกเลิก รวมไว้ในที่เดียว"
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
        <StatCard label="ทั้งหมด" value={`${counts.total.toLocaleString("th-TH")} คัน`} icon={<ClipboardCheck size={18} />} />
        <StatCard label="ติดจองรอคอนเฟิร์ม" value={`${counts.pending.toLocaleString("th-TH")} คัน`} icon={<TriangleAlert size={18} />} tone="warning" />
        <StatCard label="พร้อมส่งมอบ" value={`${counts.ready.toLocaleString("th-TH")} คัน`} icon={<ClipboardCheck size={18} />} />
        <StatCard label="ส่งมอบแล้ว" value={`${counts.delivered.toLocaleString("th-TH")} คัน`} icon={<CheckCircle2 size={18} />} tone="muted" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="ค้นหาและกรอง" icon={<Search size={18} />}>
          <SearchField
            icon={<Search size={18} />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาทะเบียน / ลูกค้า / เซลล์ / ทีม"
          />

          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>ทั้งหมด</FilterChip>
            {(["ติดจองรอคอนเฟิร์ม", "พร้อมส่งมอบ", "ส่งมอบแล้ว", "ยกเลิก"] as BookingDeliveryStatus[]).map((status) => (
              <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
                {status}
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
                const meta = statusMeta[record.status];
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

        <SectionCard title="รายละเอียดงาน" icon={<AlertCircle size={18} />}>
          {selectedRecord ? (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xl font-black text-white">{selectedRecord.plate || "-"}</p>
                    <p className="mt-1 text-sm text-soft">{selectedRecord.customerName || "-"}</p>
                  </div>
                  <NativeBadge tone={statusMeta[selectedRecord.status].tone}>{selectedRecord.status}</NativeBadge>
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

              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-bold text-white">
                  สถานะ
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as BookingDeliveryStatus }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                  >
                    {(["ติดจองรอคอนเฟิร์ม", "พร้อมส่งมอบ", "ส่งมอบแล้ว", "ยกเลิก"] as BookingDeliveryStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold text-white">
                  วันที่ส่งมอบ
                  <input
                    value={draft.deliveryDate}
                    onChange={(event) => setDraft((current) => ({ ...current, deliveryDate: event.target.value }))}
                    className="min-h-12 rounded-2xl border border-white/10 bg-[#080c12] px-4 text-white outline-none"
                    placeholder="วว/ดด/ปปปป"
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

                <label className="grid gap-2 text-sm font-bold text-white">
                  แจ้งเตือน
                  <textarea
                    value={draft.alertSummary}
                    onChange={(event) => setDraft((current) => ({ ...current, alertSummary: event.target.value }))}
                    className="min-h-24 rounded-2xl border border-white/10 bg-[#080c12] px-4 py-3 text-white outline-none"
                    placeholder="ข้อความแจ้งเตือนสั้น ๆ"
                  />
                </label>

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
                  onClick={() => setDraft((current) => ({ ...current, status: "ยกเลิก", cancelReason: current.cancelReason || "ผู้ใช้ยกเลิกรายการ" }))}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-red-400/40 bg-red-950/20 px-4 text-sm font-black text-red-100 transition hover:border-red-300"
                >
                  <XCircle size={17} />
                  ยกเลิก
                </button>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#0b0d11] p-4">
                <p className="text-sm font-bold text-soft">สรุป</p>
                <p className="mt-2 text-sm leading-6 text-white">{selectedRecord.alertSummary || selectedRecord.summary || "-"}</p>
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
