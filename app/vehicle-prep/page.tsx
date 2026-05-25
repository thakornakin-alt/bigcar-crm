"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, CheckCircle2, Download, Loader2, RefreshCw, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { ReportHistoryItem } from "@/lib/types";
import type { PrepChecklistKey, VehiclePrepRecord } from "@/lib/vehicle-prep";

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
  prep?: VehiclePrepRecord;
  badges: string[];
};

const checklist: Array<{ key: PrepChecklistKey; label: string }> = [
  { key: "decal", label: "ลอกลาย" },
  { key: "spa", label: "สปารถ" },
  { key: "oil", label: "เปลี่ยนน้ำมันเครื่อง" },
  { key: "wash", label: "ล้างรถ" }
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

function buildPrepCases(reports: ReportHistoryItem[], prepRecords: VehiclePrepRecord[]): VehiclePrepCase[] {
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const latestSalesByPlate = latestByPlate(activeReports.filter((report) => report.type === "sales"));
  const prepByBookingId = new Map(prepRecords.map((record) => [record.bookingId, record]));

  return activeReports
    .filter((report) => report.type === "booking")
    .map((booking) => {
      const plateKey = normalizePlate(booking.plate);
      const sales = latestSalesByPlate.get(plateKey);
      const paymentMode = detectPaymentMode(booking);
      const prep = prepByBookingId.get(booking.id);
      const deliveryDate = prep?.deliveryDate || (sales ? extractLineValue(sales.reportText, ["วันรับรถ"]) : "");
      const branch = sales ? extractLineValue(sales.reportText, ["สาขา"]) : "";
      const isFinanceWaiting = paymentMode === "finance" && !sales && booking.status !== "finance_approved" && !prep?.financeApprovedAt;
      const prepStatus: VehiclePrepCase["prepStatus"] = isFinanceWaiting ? "รอผลไฟแนนซ์" : "รอส่งมอบ";
      const badges = [
        paymentLabel(paymentMode),
        booking.status === "finance_approved" || prep?.financeApprovedAt ? "ไฟแนนซ์อนุมัติแล้ว" : "",
        sales ? "มีรายงานขายแล้ว" : "ยังไม่มีรายงานขาย",
        deliveryDate ? `นัดรับรถ ${deliveryDate}` : "ยังไม่ได้นัดรับรถ",
        isFinanceWaiting ? "รอใบอนุมัติไฟแนนซ์" : "รอส่งมอบ"
      ].filter(Boolean);

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
        prep,
        badges
      };
    })
    .filter((item) => item.sales?.status !== "closed" && item.sales?.status !== "delivered")
    .sort((a, b) => String(b.booking.createdAt).localeCompare(String(a.booking.createdAt)));
}

export default function VehiclePrepPage() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [prepRecords, setPrepRecords] = useState<VehiclePrepRecord[]>([]);
  const [filter, setFilter] = useState<PrepFilter>("ready");
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const cases = useMemo(() => buildPrepCases(reports, prepRecords), [reports, prepRecords]);
  const readyCases = cases.filter((item) => item.prepStatus === "รอส่งมอบ");
  const financeWaitingCases = cases.filter((item) => item.prepStatus === "รอผลไฟแนนซ์");
  const visibleCases = filter === "ready" ? readyCases : filter === "finance_waiting" ? financeWaitingCases : cases;

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const [reportData, prepData] = await Promise.all([
        api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=all"),
        api<{ records: VehiclePrepRecord[] }>("/api/vehicle-prep")
      ]);
      setReports(reportData.reports || []);
      setPrepRecords(prepData.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลเตรียมรถไม่สำเร็จ");
      setReports([]);
      setPrepRecords([]);
    } finally {
      setLoading(false);
    }
  }

  async function savePrep(input: {
    bookingId: string;
    plate: string;
    customerName: string;
    garageOutDate: string;
    garageReturnDate: string;
    deliveryDate: string;
    checklist: Record<PrepChecklistKey, boolean>;
    extraNote: string;
  }) {
    setSavingId(input.bookingId);
    setMessage("");
    setError("");
    try {
      const data = await api<{ record: VehiclePrepRecord }>("/api/vehicle-prep", {
        method: "POST",
        body: JSON.stringify(input)
      });
      setPrepRecords((current) => {
        const rest = current.filter((record) => record.bookingId !== data.record.bookingId);
        return [...rest, data.record];
      });
      setMessage("บันทึกงานส่งมอบและอัปเดตปฏิทินแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกงานส่งมอบไม่สำเร็จ");
    } finally {
      setSavingId("");
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

      {message && <div className="mb-4 rounded-lg border border-emerald-300/40 bg-emerald-950/30 px-4 py-3 text-sm font-bold text-emerald-100">{message}</div>}
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
                saving={savingId === item.id}
                onSave={savePrep}
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
              <div key={item.key} className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-bold text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                  <CheckCircle2 size={15} />
                </span>
                {item.label}
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

function PrepCaseCard({
  item,
  expanded,
  saving,
  onToggle,
  onSave
}: {
  item: VehiclePrepCase;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onSave: (input: {
    bookingId: string;
    plate: string;
    customerName: string;
    garageOutDate: string;
    garageReturnDate: string;
    deliveryDate: string;
    checklist: Record<PrepChecklistKey, boolean>;
    extraNote: string;
  }) => void;
}) {
  const [garageOutDate, setGarageOutDate] = useState(item.prep?.garageOutDate || "");
  const [garageReturnDate, setGarageReturnDate] = useState(item.prep?.garageReturnDate || "");
  const [deliveryDate, setDeliveryDate] = useState(isoDateOrEmpty(item.prep?.deliveryDate || item.deliveryDate));
  const [checks, setChecks] = useState<Record<PrepChecklistKey, boolean>>({
    decal: Boolean(item.prep?.checklist?.decal),
    spa: Boolean(item.prep?.checklist?.spa),
    oil: Boolean(item.prep?.checklist?.oil),
    wash: Boolean(item.prep?.checklist?.wash)
  });
  const [extraNote, setExtraNote] = useState(item.prep?.extraNote || "");

  function save() {
    onSave({
      bookingId: item.id,
      plate: item.plate,
      customerName: item.customerName,
      garageOutDate,
      garageReturnDate,
      deliveryDate,
      checklist: checks,
      extraNote
    });
  }

  function exportPng() {
    exportPrepPng({
      plate: item.plate,
      customerName: item.customerName,
      model: item.model,
      garageOutDate,
      garageReturnDate,
      deliveryDate,
      checklist: checks,
      extraNote
    });
  }

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
          <PrepTimeline
            garageOutDate={garageOutDate}
            garageReturnDate={garageReturnDate}
            deliveryDate={deliveryDate}
            checklist={checks}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoRow label="รุ่นรถ" value={item.model} />
            <InfoRow label="ประเภทการซื้อ" value={item.paymentLabel} />
            <DateField label="วันส่งอู่" value={garageOutDate} onChange={setGarageOutDate} />
            <DateField label="วันรถกลับจากอู่" value={garageReturnDate} onChange={setGarageReturnDate} />
            <DateField label="วันนัดส่งมอบ" value={deliveryDate} onChange={setDeliveryDate} />
            <InfoRow label="แจ้งเตือนปฏิทิน" value="กดบันทึกแล้วเข้าปฏิทินอัตโนมัติ" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {checklist.map((check) => (
              <label key={check.key} className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-black/20 px-3 text-sm font-bold text-white">
                <input
                  type="checkbox"
                  checked={checks[check.key]}
                  onChange={(event) => setChecks((current) => ({ ...current, [check.key]: event.target.checked }))}
                  className="h-4 w-4 accent-brand"
                />
                {check.label}
              </label>
            ))}
          </div>
          <textarea
            rows={3}
            placeholder="อื่นๆ"
            value={extraNote}
            onChange={(event) => setExtraNote(event.target.value)}
            className="mt-3 min-h-20 w-full rounded-lg border border-line bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={save} disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink disabled:opacity-60">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              บันทึกงานส่งมอบ
            </button>
            <button type="button" onClick={exportPng} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
              <Download size={17} />
              Export PNG
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PrepTimeline({
  garageOutDate,
  garageReturnDate,
  deliveryDate,
  checklist: checks
}: {
  garageOutDate: string;
  garageReturnDate: string;
  deliveryDate: string;
  checklist: Record<PrepChecklistKey, boolean>;
}) {
  const checklistDone = checklist.every((item) => checks[item.key]);
  const steps = [
    { label: "ส่งอู่", value: garageOutDate, done: Boolean(garageOutDate) },
    { label: "รถกลับ", value: garageReturnDate, done: Boolean(garageReturnDate) },
    { label: "Checklist", value: checklistDone ? "ครบแล้ว" : "ยังไม่ครบ", done: checklistDone },
    { label: "ส่งมอบ", value: deliveryDate, done: Boolean(deliveryDate) }
  ];

  return (
    <div className="mt-3 rounded-xl border border-line bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-black text-white">ไทม์ไลน์งานรถ</p>
        <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-black text-brand">
          {steps.filter((step) => step.done).length}/{steps.length}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="relative rounded-lg border border-line bg-[#0b0d11] p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${step.done ? "bg-brand text-ink" : "bg-panel text-soft"}`}>
                {index + 1}
              </span>
              <p className="text-sm font-black text-white">{step.label}</p>
            </div>
            <p className={`mt-2 text-xs font-bold ${step.done ? "text-brand" : "text-soft"}`}>
              {formatTimelineValue(step.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-lg border border-line bg-black/20 px-3 py-2">
      <span className="text-xs text-soft">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full bg-transparent text-sm font-black text-white outline-none"
      />
    </label>
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

function isoDateOrEmpty(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : "";
}

function formatTimelineValue(value: string) {
  if (!value) return "รอระบุ";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function exportPrepPng(input: {
  plate: string;
  customerName: string;
  model: string;
  garageOutDate: string;
  garageReturnDate: string;
  deliveryDate: string;
  checklist: Record<PrepChecklistKey, boolean>;
  extraNote: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 820;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#f7f8f6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f1720";
  ctx.font = "800 52px Arial";
  ctx.fillText("สรุปงานรอส่งมอบ", 64, 92);
  ctx.fillStyle = "#0bbf72";
  ctx.fillRect(64, 124, 10, 150);

  ctx.fillStyle = "#0f1720";
  ctx.font = "800 38px Arial";
  ctx.fillText(input.plate || "-", 96, 162);
  ctx.font = "700 30px Arial";
  ctx.fillText(input.customerName || "-", 96, 208);
  ctx.font = "600 24px Arial";
  ctx.fillStyle = "#56606d";
  ctx.fillText(input.model || "-", 96, 248);

  const rows = [
    ["วันส่งอู่", input.garageOutDate || "-"],
    ["วันรถกลับจากอู่", input.garageReturnDate || "-"],
    ["วันนัดส่งมอบ", input.deliveryDate || "-"]
  ];

  ctx.font = "800 26px Arial";
  rows.forEach(([label, value], index) => {
    const y = 350 + index * 78;
    ctx.fillStyle = "#e9fbf2";
    ctx.fillRect(64, y - 42, 500, 58);
    ctx.fillStyle = "#56606d";
    ctx.fillText(label, 88, y - 5);
    ctx.fillStyle = "#0f1720";
    ctx.fillText(value, 340, y - 5);
  });

  ctx.fillStyle = "#0f1720";
  ctx.font = "800 30px Arial";
  ctx.fillText("Checklist", 650, 330);
  ctx.font = "700 26px Arial";
  checklist.forEach((item, index) => {
    const y = 386 + index * 56;
    ctx.fillStyle = input.checklist[item.key] ? "#0bbf72" : "#d3d8df";
    ctx.beginPath();
    ctx.arc(670, y - 8, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f1720";
    ctx.fillText(item.label, 700, y);
  });

  ctx.fillStyle = "#56606d";
  ctx.font = "600 24px Arial";
  wrapCanvasText(ctx, input.extraNote || "ไม่มีหมายเหตุเพิ่มเติม", 64, 650, 1060, 34);

  const link = document.createElement("a");
  link.download = `prep-${input.plate || "vehicle"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
}
