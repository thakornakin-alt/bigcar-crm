"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clipboard, Cloud, Eye, FileText, Loader2, Mail, Search } from "lucide-react";
import type { ReportHistoryItem, ReportHistoryType } from "@/lib/types";

type FilterType = "all" | ReportHistoryType;

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function typeLabel(type: ReportHistoryType) {
  return type === "booking" ? "รายงานจอง" : "รายงานขาย";
}

function statusLabel(value: string) {
  if (!value) return "draft";
  if (value === "draft_created") return "สร้าง Gmail Draft แล้ว";
  if (value === "draft_only") return "Draft เท่านั้น";
  return value;
}

export default function ReportHistoryPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<FilterType>("all");
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [selected, setSelected] = useState<ReportHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => ({
    all: reports.length,
    booking: reports.filter((report) => report.type === "booking").length,
    sales: reports.filter((report) => report.type === "sales").length
  }), [reports]);

  async function loadReports(nextQuery = query, nextType = type) {
    setError("");
    setMessage("");
    const data = await api<{ reports: ReportHistoryItem[] }>(
      `/api/reports/history?q=${encodeURIComponent(nextQuery)}&type=${encodeURIComponent(nextType)}`
    );
    setReports(data.reports);
    if (!data.reports.length) setMessage("ไม่พบประวัติรายงานที่ตรงกับคำค้น");
  }

  useEffect(() => {
    loadReports("", "all")
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดประวัติไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function changeType(nextType: FilterType) {
    setType(nextType);
    setLoading(true);
    try {
      await loadReports(query, nextType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดประวัติไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function copyReport(report: ReportHistoryItem) {
    setCopying(true);
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(report.reportText || "");
      setMessage("คัดลอกข้อความรายงานแล้ว");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้ว copy เอง");
    } finally {
      window.setTimeout(() => setCopying(false), 500);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">ประวัติรายงาน</h1>
          <p className="mt-1 text-sm text-soft">ค้นรายงานจอง/รายงานขายย้อนหลัง ดู Drive, Draft และข้อความรายงาน</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/booking-reports" className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white">
            <FileText size={18} className="text-brand" />
            จอง
          </Link>
          <Link href="/sales-reports" className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white">
            <FileText size={18} className="text-brand" />
            ขาย
          </Link>
          <Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white">
            <ArrowLeft size={18} className="text-brand" />
            ลูกค้า
          </Link>
        </div>
      </header>

      {(message || error) && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-amber-400/40 bg-amber-950/30 text-amber-100" : "border-brand/40 bg-green-950/30 text-green-100"}`}>
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{error || message}</span>
        </div>
      )}

      <section className="mb-4 rounded-lg border border-line bg-panel p-4 shadow-glow">
        <form onSubmit={search} className="space-y-3">
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3">
            <Search size={20} className="text-soft" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นชื่อ เบอร์ ทะเบียน รุ่นรถ"
              className="h-12 w-full bg-transparent text-white outline-none placeholder:text-[#6f7785]"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["all", `ทั้งหมด ${counts.all}`],
              ["booking", `จอง ${counts.booking}`],
              ["sales", `ขาย ${counts.sales}`]
            ] as Array<[FilterType, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => changeType(key)}
                className={`min-h-11 rounded-lg border px-3 font-semibold ${type === key ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            ค้นประวัติ
          </button>
        </form>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
        <div className="space-y-3">
          {loading ? (
            <div className="flex min-h-28 items-center justify-center rounded-lg border border-line bg-panel text-soft">
              <Loader2 size={22} className="mr-2 animate-spin" />
              Loading
            </div>
          ) : reports.length ? reports.map((report) => (
            <button
              key={`${report.type}-${report.id}`}
              type="button"
              onClick={() => setSelected(report)}
              className={`w-full rounded-lg border p-4 text-left transition active:scale-[0.99] ${selected?.id === report.id ? "border-brand bg-[#101720]" : "border-line bg-panel hover:border-brand/60"}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">{report.customerName || "-"}</p>
                  <p className="mt-1 truncate text-sm text-soft">{report.plate} / {report.model}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#1b2028] px-2.5 py-1 text-xs text-brand">{typeLabel(report.type)}</span>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-[#cfd5df]">
                <span>{report.createdAt}</span>
                <span>{report.phone}</span>
                <span>Sale {report.saleName}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill icon={<Mail size={14} />} label={statusLabel(report.emailStatus)} />
                {report.driveFolderUrl && <StatusPill icon={<Cloud size={14} />} label="Drive" />}
                {!!report.attachments.length && <StatusPill icon={<FileText size={14} />} label={`${report.attachments.length} ไฟล์`} />}
              </div>
            </button>
          )) : (
            <div className="rounded-lg border border-line bg-panel px-4 py-8 text-center text-soft">ไม่พบประวัติรายงาน</div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{typeLabel(selected.type)}</p>
                  <h2 className="mt-1 text-xl font-bold text-white">{selected.customerName || "-"}</h2>
                  <p className="mt-1 text-sm text-soft">{selected.plate} / {selected.brand} {selected.model} / {selected.year}</p>
                </div>

                <div className="grid gap-2 text-sm">
                  <InfoRow label="วันที่" value={selected.createdAt} />
                  <InfoRow label="Sale" value={`${selected.saleName} ทีม${selected.teamName || ""}`} />
                  <InfoRow label="หัวข้อ" value={selected.emailSubject} />
                  <InfoRow label="To" value={selected.emailTo} />
                  <InfoRow label="CC" value={selected.emailCc} />
                  <InfoRow label="Email" value={statusLabel(selected.emailStatus)} />
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => copyReport(selected)}
                    disabled={copying}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 font-semibold text-brand"
                  >
                    {copying ? <Loader2 size={18} className="animate-spin" /> : <Clipboard size={18} />}
                    Copy รายงาน
                  </button>
                  {selected.driveFolderUrl && (
                    <a href={selected.driveFolderUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 font-semibold text-brand">
                      <Cloud size={18} />
                      เปิด Drive Folder
                    </a>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-white">ไฟล์แนบ</p>
                  {selected.attachments.length ? (
                    <div className="grid gap-2">
                      {selected.attachments.map((attachment, index) => (
                        <a
                          key={`${attachment.name}-${index}`}
                          href={attachment.url || attachment.folderUrl || selected.driveFolderUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate text-white">{attachment.name}</span>
                          <Eye size={16} className="shrink-0 text-brand" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">ยังไม่มีไฟล์แนบที่เปิดดูได้</p>
                  )}
                </div>

                <pre className="max-h-[42vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-7 text-white">
                  {selected.reportText || "ไม่มีข้อความรายงาน"}
                </pre>
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
                เลือกรายงานเพื่อดูรายละเอียด
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

function StatusPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[#0b0d11] px-2.5 py-1 text-xs text-soft">
      <span className="text-brand">{icon}</span>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">
      <p className="text-xs text-soft">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value || "-"}</p>
    </div>
  );
}
