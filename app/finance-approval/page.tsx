"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileUp, Loader2, RefreshCw, Search, UploadCloud } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { ReportHistoryItem } from "@/lib/types";

type FinanceCase = {
  id: string;
  plate: string;
  customerName: string;
  model: string;
  owner: string;
  createdAt: string;
  status: "รอผลไฟแนนซ์";
  booking: ReportHistoryItem;
};

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
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

function buildFinanceCases(reports: ReportHistoryItem[]): FinanceCase[] {
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const salesPlates = new Set(
    activeReports
      .filter((report) => report.type === "sales")
      .map((report) => normalizePlate(report.plate))
      .filter(Boolean)
  );

  return activeReports
    .filter((report) => report.type === "booking")
    .filter((report) => isFinanceBooking(report))
    .filter((report) => !salesPlates.has(normalizePlate(report.plate)))
    .map((booking) => {
      const status: FinanceCase["status"] = "รอผลไฟแนนซ์";
      return {
        id: booking.id,
        plate: booking.plate || "-",
        customerName: booking.customerName || "-",
        model: [booking.brand, booking.model, booking.year].filter(Boolean).join(" ") || "-",
        owner: [booking.saleName, booking.teamName ? `ทีม${booking.teamName}` : ""].filter(Boolean).join(" "),
        createdAt: booking.createdAt,
        status,
        booking
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default function FinanceApprovalPage() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualPlate, setManualPlate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const financeCases = useMemo(() => buildFinanceCases(reports), [reports]);
  const visibleCases = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!term) return financeCases;
    return financeCases.filter((item) =>
      [item.plate, item.customerName, item.model, item.owner].join("").toLowerCase().replace(/\s+/g, "").includes(term)
    );
  }, [financeCases, query]);

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=all");
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดเคสไฟแนนซ์ไม่สำเร็จ");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  function toggleCase(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="รอผลไฟแนนซ์"
        subtitle="เพิ่มใบอนุมัติ PO แล้วเลือกทะเบียนที่เกี่ยวข้อง"
        actions={
          <>
            <button
              type="button"
              onClick={loadReports}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-bold text-white"
            >
              {loading ? <Loader2 size={17} className="animate-spin text-brand" /> : <RefreshCw size={17} className="text-brand" />}
              Refresh
            </button>
            <TopMenuButton href="/vehicle-prep" icon={<CheckCircle2 size={18} />} variant="primary">
              รอส่งมอบ
            </TopMenuButton>
          </>
        }
      />

      {error && <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{error}</div>}

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="รอผลไฟแนนซ์" value={`${financeCases.length.toLocaleString("th-TH")} เคส`} />
        <SummaryCard label="แสดงตามคำค้น" value={`${visibleCases.length.toLocaleString("th-TH")} เคส`} />
        <SummaryCard label="เลือกแล้ว" value={`${selectedIds.length.toLocaleString("th-TH")} ทะเบียน`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="อัปโหลดใบอนุมัติ" icon={<UploadCloud size={18} />}>
            <div className="rounded-lg border border-dashed border-brand/40 bg-brand/10 px-4 py-6 text-center">
              <FileUp size={28} className="mx-auto text-brand" />
              <p className="mt-3 text-lg font-black text-white">เพิ่มไฟล์ใบอนุมัติ</p>
              <p className="mt-1 text-sm leading-6 text-soft">PDF / รูปภาพ / เอกสารไฟแนนซ์</p>
              <button type="button" className="mt-4 min-h-11 rounded-lg bg-brand px-4 text-sm font-black text-ink">
                เลือกไฟล์
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">หรือระบุทะเบียนเอง</span>
              <input
                value={manualPlate}
                onChange={(event) => setManualPlate(event.target.value)}
                placeholder="เช่น 1ขห 9832"
                className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
              />
            </label>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="เลือกทะเบียนที่เกี่ยวข้อง" icon={<Search size={18} />}>
            <SearchField
              icon={<Search size={18} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นทะเบียน / ลูกค้า / เซลล์เจ้าของเคส"
            />
            <div className="flex flex-wrap gap-2">
              <FilterChip active>รอผลไฟแนนซ์</FilterChip>
              <FilterChip disabled>อนุมัติแล้ว</FilterChip>
              <FilterChip disabled>ไม่ผ่าน</FilterChip>
            </div>
            {loading ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
                <Loader2 size={22} className="mr-2 animate-spin text-brand" />
                Loading
              </div>
            ) : visibleCases.length ? (
              visibleCases.map((item) => (
                <FinanceCaseCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onToggle={() => toggleCase(item.id)}
                />
              ))
            ) : (
              <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
                ไม่พบเคสไฟแนนซ์ที่ยังรอผล
              </div>
            )}
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function FinanceCaseCard({ item, selected, onToggle }: { item: FinanceCase; selected: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded-lg border p-3 ${selected ? "border-brand bg-brand/10" : "border-line bg-[#0b0d11]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{item.plate}</p>
          <p className="mt-1 text-sm text-soft">{item.model} · {item.customerName}</p>
          <p className="mt-1 text-xs text-soft">เจ้าของเคส: {item.owner || "-"}</p>
        </div>
        <span className="rounded-full border border-amber-300/40 px-2.5 py-1 text-xs font-black text-amber-100">{item.status}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <InfoBox label="วันที่จอง" value={item.createdAt || "-"} />
        <InfoBox label="สถานะถัดไป" value="รอแนบใบอนุมัติ" />
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`mt-3 min-h-10 w-full rounded-lg border px-3 text-sm font-black ${selected ? "border-brand bg-brand text-ink" : "border-line bg-panel text-white"}`}
      >
        {selected ? "เลือกแล้ว" : "ติ๊กเลือกทะเบียนนี้"}
      </button>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-soft">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-3 py-2">
      <p className="text-xs text-soft">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
