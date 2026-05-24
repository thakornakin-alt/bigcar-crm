"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, Car, CheckCircle2, FileText, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { ReportHistoryItem } from "@/lib/types";

type CaseFilter = "ready" | "waiting_delivery" | "closed";

type CloseCase = {
  id: string;
  plate: string;
  model: string;
  customerName: string;
  owner: string;
  deliveredAt: string;
  status: "พร้อมปิดเคส" | "รอส่งมอบ" | "ปิดแล้ว";
  sales: ReportHistoryItem;
};

const closeEffects = [
  "ไม่ขึ้นในงาน Active",
  "ไม่แจ้งเตือนซ้ำ",
  "ไม่ขึ้นในอัปโหลดไฟแนนซ์",
  "เก็บไว้ในรายงานย้อนหลัง",
  "นำไปสรุป Dashboard / คอมมิชชั่น"
];

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
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
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

function buildCloseCases(reports: ReportHistoryItem[]): CloseCase[] {
  return reports
    .filter((report) => report.type === "sales")
    .filter((report) => report.status !== "deleted")
    .map((sales) => {
      const deliveredAt = extractLineValue(sales.reportText, ["วันรับรถ"]);
      const isClosed = sales.status === "closed" || sales.status === "delivered";
      const status: CloseCase["status"] = isClosed ? "ปิดแล้ว" : deliveredAt ? "พร้อมปิดเคส" : "รอส่งมอบ";
      return {
        id: sales.id,
        plate: sales.plate || "-",
        model: [sales.brand, sales.model, sales.year].filter(Boolean).join(" ") || "-",
        customerName: sales.customerName || "-",
        owner: [sales.saleName, sales.teamName ? `ทีม${sales.teamName}` : ""].filter(Boolean).join(" "),
        deliveredAt: deliveredAt || "-",
        status,
        sales
      };
    })
    .sort((a, b) => String(b.sales.createdAt).localeCompare(String(a.sales.createdAt)));
}

export default function CaseClosurePage() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CaseFilter>("ready");
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const closeCases = useMemo(() => buildCloseCases(reports), [reports]);
  const filteredByStatus = useMemo(() => {
    if (filter === "ready") return closeCases.filter((item) => item.status === "พร้อมปิดเคส");
    if (filter === "waiting_delivery") return closeCases.filter((item) => item.status === "รอส่งมอบ");
    return closeCases.filter((item) => item.status === "ปิดแล้ว");
  }, [closeCases, filter]);
  const visibleCases = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!term) return filteredByStatus;
    return filteredByStatus.filter((item) =>
      [item.plate, item.customerName, item.model, item.owner].join("").toLowerCase().replace(/\s+/g, "").includes(term)
    );
  }, [filteredByStatus, query]);

  const readyCount = closeCases.filter((item) => item.status === "พร้อมปิดเคส").length;
  const waitingCount = closeCases.filter((item) => item.status === "รอส่งมอบ").length;
  const closedCount = closeCases.filter((item) => item.status === "ปิดแล้ว").length;

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=sales");
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดเคสปิดงานไม่สำเร็จ");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function closeCase(id: string) {
    setClosingId(id);
    setError("");
    setMessage("");
    try {
      await api("/api/reports/status", {
        method: "POST",
        body: JSON.stringify({ id, type: "sales", status: "closed" })
      });
      setMessage("ปิดเคสและย้ายเข้า ส่งมอบแล้ว เรียบร้อย");
      await loadReports();
      setFilter("closed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ปิดเคสไม่สำเร็จ");
    } finally {
      setClosingId("");
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="ปิดเคส / ส่งมอบแล้ว"
        subtitle="ดึงจากรายงานขายจริง ใช้หลังส่งมอบรถแล้วเพื่อเก็บเคสเข้าประวัติและหยุดแจ้งเตือนงาน Active"
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
            <TopMenuButton href="/sales-reports" icon={<FileText size={18} />} variant="primary">
              รายงานขาย
            </TopMenuButton>
          </>
        }
      />

      {message && <div className="mb-4 rounded-lg border border-emerald-300/40 bg-emerald-950/30 px-4 py-3 text-sm font-bold text-emerald-100">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{error}</div>}

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="พร้อมปิดเคส" value={`${readyCount.toLocaleString("th-TH")} เคส`} />
        <SummaryCard label="รอส่งมอบ" value={`${waitingCount.toLocaleString("th-TH")} เคส`} />
        <SummaryCard label="ปิดแล้ว" value={`${closedCount.toLocaleString("th-TH")} เคส`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="ค้นหาเคสส่งมอบ" icon={<Search size={18} />}>
            <SearchField
              icon={<Search size={18} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นทะเบียน / ลูกค้า / เซลล์เจ้าของเคส"
            />
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filter === "ready"} onClick={() => setFilter("ready")}>พร้อมปิดเคส</FilterChip>
              <FilterChip active={filter === "waiting_delivery"} onClick={() => setFilter("waiting_delivery")}>รอส่งมอบ</FilterChip>
              <FilterChip active={filter === "closed"} onClick={() => setFilter("closed")}>ปิดแล้ว</FilterChip>
            </div>
            <div className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-3 text-sm leading-6 text-amber-100">
              ปิดเคสควรทำหลังส่งมอบแล้วเท่านั้น เพื่อป้องกันเคสหายจากงาน Active เร็วเกินจริง
            </div>
          </SectionCard>

          <SectionCard title="ผลหลังปิดเคส" icon={<ShieldCheck size={18} />}>
            <div className="grid gap-2">
              {closeEffects.map((item) => (
                <EffectItem key={item}>{item}</EffectItem>
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="รายการเคส" icon={<Archive size={18} />}>
            {loading ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
                <Loader2 size={22} className="mr-2 animate-spin text-brand" />
                Loading
              </div>
            ) : visibleCases.length ? (
              visibleCases.map((item) => <CloseCaseCard key={item.id} item={item} closing={closingId === item.id} onClose={() => closeCase(item.id)} />)
            ) : (
              <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
                ไม่พบเคสในสถานะนี้
              </div>
            )}
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function CloseCaseCard({ item, closing, onClose }: { item: CloseCase; closing: boolean; onClose: () => void }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{item.plate}</p>
          <p className="mt-1 text-sm text-soft">{item.model} · {item.customerName}</p>
          <p className="mt-1 text-xs text-soft">เจ้าของเคส: {item.owner || "-"}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${item.status === "พร้อมปิดเคส" ? "border-brand/40 bg-brand/10 text-brand" : "border-amber-300/40 text-amber-100"}`}>
          {item.status}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <InfoBox icon={<CalendarDays size={16} />} label="วันที่ส่งมอบ" value={item.deliveredAt} />
        <InfoBox icon={<Car size={16} />} label="สถานะเคส" value={item.status === "พร้อมปิดเคส" ? "รอปิดเคสจริง" : item.status} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink disabled:opacity-60"
          disabled={item.status !== "พร้อมปิดเคส" || closing}
        >
          {closing ? <Loader2 size={16} className="animate-spin" /> : null}
          {closing ? "กำลังปิดเคส..." : "ปิดเคส"}
        </button>
        <a href="/sales-reports" className="flex min-h-10 items-center justify-center rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
          เปิดรายงานขาย
        </a>
      </div>
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

function EffectItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
      <CheckCircle2 size={16} className="text-brand" />
      {children}
    </div>
  );
}

function InfoBox({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-bold text-soft">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
