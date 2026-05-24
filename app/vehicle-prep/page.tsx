"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, CheckCircle2, Download, Loader2, RefreshCw, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { ReportHistoryItem } from "@/lib/types";

type PrepFilter = "ready" | "finance_waiting" | "all";
type PaymentMode = "cash" | "finance" | "unknown";

type VehiclePrepCase = {
  id: string;
  plate: string;
  model: string;
  customerName: string;
  owner: string;
  branch: string;
  paymentMode: PaymentMode;
  paymentLabel: string;
  financeStatus: string;
  prepStatus: "รอส่งมอบ" | "รอผลไฟแนนซ์";
  deliveryDate: string;
  booking: ReportHistoryItem;
  sales?: ReportHistoryItem;
  badges: string[];
};

const checklist = ["ลอกลาย", "สปารถ", "เปลี่ยนน้ำมันเครื่อง", "ล้างรถ"];

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
      if (compact.startsWith(label)) {
        return compact.slice(label.length).replace(/^[:：\s-]+/, "").trim();
      }
    }
  }
  return "";
}

function detectPaymentMode(report: ReportHistoryItem): PaymentMode {
  const payment = extractLineValue(report.reportText, ["การชำระเงิน"]);
  const source = `${payment} ${report.reportText}`.toLowerCase();
  if (source.includes("ไฟแนนซ์") || source.includes("finance")) return "finance";
  if (source.includes("สด") || source.includes("cash")) return "cash";
  return "unknown";
}

function paymentLabel(mode: PaymentMode) {
  if (mode === "cash") return "ซื้อสด";
  if (mode === "finance") return "ไฟแนนซ์";
  return "ยังไม่ระบุ";
}

function latestByPlate(reports: ReportHistoryItem[]) {
  const map = new Map<string, ReportHistoryItem>();
  for (const report of reports) {
    const key = normalizePlate(report.plate);
    if (!key) continue;
    const current = map.get(key);
    if (!current || String(report.createdAt).localeCompare(String(current.createdAt)) > 0) {
      map.set(key, report);
    }
  }
  return map;
}

function buildPrepCases(reports: ReportHistoryItem[]): VehiclePrepCase[] {
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const latestSalesByPlate = latestByPlate(activeReports.filter((report) => report.type === "sales"));

  return activeReports
    .filter((report) => report.type === "booking")
    .map((booking) => {
      const plateKey = normalizePlate(booking.plate);
      const sales = latestSalesByPlate.get(plateKey);
      const paymentMode = detectPaymentMode(booking);
      const deliveryDate = sales ? extractLineValue(sales.reportText, ["วันรับรถ"]) : "";
      const branch = sales ? extractLineValue(sales.reportText, ["สาขา"]) : "";
      const isFinanceWaiting = paymentMode === "finance" && !sales;
      const prepStatus: VehiclePrepCase["prepStatus"] = isFinanceWaiting ? "รอผลไฟแนนซ์" : "รอส่งมอบ";
      const badges = [
        paymentLabel(paymentMode),
        sales ? "มีรายงานขายแล้ว" : "ยังไม่มีรายงานขาย",
        deliveryDate ? `นัดรับรถ ${deliveryDate}` : "ยังไม่ได้นัดรับรถ",
        isFinanceWaiting ? "รอใบอนุมัติไฟแนนซ์" : "รอส่งมอบ"
      ];

      return {
        id: booking.id,
        plate: booking.plate || "-",
        model: [booking.brand, booking.model, booking.year].filter(Boolean).join(" ") || "-",
        customerName: booking.customerName || "-",
        owner: [booking.saleName, booking.teamName ? `ทีม${booking.teamName}` : ""].filter(Boolean).join(" "),
        branch: branch || "-",
        paymentMode,
        paymentLabel: paymentLabel(paymentMode),
        financeStatus: isFinanceWaiting ? "รอผลไฟแนนซ์" : "รอส่งมอบ",
        prepStatus,
        deliveryDate: deliveryDate || "-",
        booking,
        sales,
        badges
      };
    })
    .sort((a, b) => String(b.booking.createdAt).localeCompare(String(a.booking.createdAt)));
}

export default function VehiclePrepPage() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [filter, setFilter] = useState<PrepFilter>("ready");
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cases = useMemo(() => buildPrepCases(reports), [reports]);
  const readyCases = cases.filter((item) => item.prepStatus === "รอส่งมอบ");
  const financeWaitingCases = cases.filter((item) => item.prepStatus === "รอผลไฟแนนซ์");
  const visibleCases = filter === "ready" ? readyCases : filter === "finance_waiting" ? financeWaitingCases : cases;

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=all");
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลเตรียมรถไม่สำเร็จ");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <PageContainer wide>
      <PageTitle
        title="รอส่งมอบ"
        subtitle="ทะเบียนที่ต้องติดตามจนส่งมอบเสร็จ"
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
            <TopMenuButton href="/calendar" icon={<CalendarDays size={18} />} variant="primary">
              ปฏิทิน
            </TopMenuButton>
          </>
        }
      />

      {error && <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{error}</div>}

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="รอส่งมอบ" value={`${readyCases.length.toLocaleString("th-TH")} คัน`} />
        <SummaryCard label="รอผลไฟแนนซ์" value={`${financeWaitingCases.length.toLocaleString("th-TH")} คัน`} />
        <SummaryCard label="เคส Active" value={`${cases.length.toLocaleString("th-TH")} เคส`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="รายการรอส่งมอบ" icon={<Wrench size={18} />}>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "ready"} onClick={() => setFilter("ready")}>รอส่งมอบ</FilterChip>
            <FilterChip active={filter === "finance_waiting"} onClick={() => setFilter("finance_waiting")}>รอผลไฟแนนซ์</FilterChip>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>ทั้งหมด</FilterChip>
          </div>

          {loading ? (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
              <Loader2 size={22} className="mr-2 animate-spin text-brand" />
              Loading
            </div>
          ) : visibleCases.length ? (
            visibleCases.map((item) => (
              <PrepCaseCard
                key={`${item.id}-${item.plate}`}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => current === item.id ? "" : item.id)}
              />
            ))
          ) : (
            <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
              ยังไม่มีรถในสถานะนี้จากรายงานจอง
            </div>
          )}
        </SectionCard>

        <SectionCard title="Preview งานส่งมอบ" icon={<CheckCircle2 size={18} />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <div key={item} className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-bold text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                  <CheckCircle2 size={15} />
                </span>
                {item}
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <InfoTile icon={<CalendarDays size={18} />} label="ปฏิทินใหญ่" value="รถกลับ / นัดรับ / ส่งมอบ" />
            <InfoTile icon={<Download size={18} />} label="Export PNG" value="สรุปงานส่งมอบ" />
            <InfoTile icon={<Car size={18} />} label="ปิดเคส" value="หลังส่งมอบแล้ว" />
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function PrepCaseCard({ item, expanded, onToggle }: { item: VehiclePrepCase; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{item.plate}</p>
          <p className="mt-1 text-sm text-soft">{item.customerName}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${item.prepStatus === "รอส่งมอบ" ? "border-brand/40 text-brand" : "border-amber-300/40 text-amber-100"}`}>
          {item.financeStatus}
        </span>
      </div>
      <button type="button" onClick={onToggle} className="mt-3 min-h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
        {expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
      </button>
      {expanded && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoRow label="รุ่นรถ" value={item.model} />
            <InfoRow label="ประเภทการซื้อ" value={item.paymentLabel} />
            <InfoRow label="วันส่งอู่" value="-" />
            <InfoRow label="วันรถกลับจากอู่" value="-" />
            <InfoRow label="วันนัดส่งมอบ" value={item.deliveryDate} />
            <InfoRow label="แจ้งเตือนปฏิทิน" value="เชื่อมปฏิทินใหญ่" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <label key={item} className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-black/20 px-3 text-sm font-bold text-white">
                <input type="checkbox" className="h-4 w-4 accent-brand" />
                {item}
              </label>
            ))}
          </div>
          <textarea
            rows={3}
            placeholder="อื่นๆ"
            className="mt-3 min-h-20 w-full rounded-lg border border-line bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
          />
        </>
      )}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-3 py-2">
      <p className="text-xs text-soft">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value || "-"}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">
      <div className="mb-2 text-brand">{icon}</div>
      <p className="text-sm font-black text-white">{label}</p>
      <p className="mt-1 text-xs text-soft">{value}</p>
    </div>
  );
}
