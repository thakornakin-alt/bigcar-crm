"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import type { StockImportResult, StockImportStatus, StockVehicle } from "@/lib/types";

type RawRow = Record<string, unknown>;

const chunkSize = 300;
const fieldLabels: Array<{ key: keyof StockVehicle; label: string; aliases: string[] }> = [
  { key: "plate", label: "ทะเบียนรถ", aliases: ["ทะเบียนรถ", "ทะเบียน", "plate", "licenseplate", "regno", "เลขทะเบียน"] },
  { key: "brand", label: "ยี่ห้อรถ", aliases: ["ยี่ห้อรถ", "ยี่ห้อ", "brand", "make"] },
  { key: "model", label: "รุ่นรถ", aliases: ["รุ่นรถ", "รุ่น", "model"] },
  { key: "year", label: "ปีรถ", aliases: ["ปีรถ", "ปี", "year", "modelyear"] },
  { key: "color", label: "สีรถ", aliases: ["สีรถ", "สี", "color", "colour"] },
  { key: "salePrice", label: "ราคาตั้งขาย", aliases: ["ราคาตั้งขาย", "ราคา", "price", "saleprice", "sellingprice"] },
  { key: "source", label: "แหล่งที่มา", aliases: ["แหล่งที่มา", "source"] },
  { key: "ownership", label: "กรรมสิทธิ์", aliases: ["กรรมสิทธิ์", "ownership"] },
  { key: "project", label: "Project", aliases: ["project", "โปรเจกต์"] },
  { key: "campaign", label: "Campaign", aliases: ["campaign", "แคมเปญ"] }
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[()/_-]/g, "");
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function detectMapping(headers: string[]) {
  const normalized = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));

  return fieldLabels.reduce<Record<keyof StockVehicle, string>>((mapping, field) => {
    const found = normalized.find((item) => field.aliases.some((alias) => item.normalized === normalizeHeader(alias)));
    mapping[field.key] = found?.header || "";
    return mapping;
  }, {} as Record<keyof StockVehicle, string>);
}

function mapRows(rows: RawRow[], mapping: Record<keyof StockVehicle, string>) {
  return rows
    .map((row) => ({
      plate: cell(row[mapping.plate]),
      brand: cell(row[mapping.brand]),
      model: cell(row[mapping.model]),
      year: cell(row[mapping.year]),
      color: cell(row[mapping.color]),
      salePrice: cell(row[mapping.salePrice]).replace(/[^\d.]/g, ""),
      source: cell(row[mapping.source]),
      ownership: cell(row[mapping.ownership]),
      project: cell(row[mapping.project]),
      campaign: cell(row[mapping.campaign])
    }))
    .filter((row) => row.plate);
}

export default function StockImportPage() {
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [workbookRows, setWorkbookRows] = useState<Record<string, RawRow[]>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<keyof StockVehicle, string>>(detectMapping([]));
  const [status, setStatus] = useState<StockImportStatus>({ total: 0, latestImportedAt: "", latestUpdatedAt: "" });
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const parsedRows = useMemo(() => mapRows(workbookRows[activeSheet] || [], mapping), [activeSheet, mapping, workbookRows]);
  const previewRows = parsedRows.slice(0, 8);
  const missingPlate = !mapping.plate;

  useEffect(() => {
    api<{ status: StockImportStatus }>("/api/stock/status")
      .then((data) => setStatus(data.status))
      .catch(() => undefined);
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");
    setProgress(0);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const nextRows: Record<string, RawRow[]> = {};

      workbook.SheetNames.forEach((name) => {
        const sheet = workbook.Sheets[name];
        nextRows[name] = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
      });

      const firstSheet = workbook.SheetNames[0] || "";
      const firstRows = nextRows[firstSheet] || [];
      const nextHeaders = Object.keys(firstRows[0] || {});

      setSheetNames(workbook.SheetNames);
      setActiveSheet(firstSheet);
      setWorkbookRows(nextRows);
      setHeaders(nextHeaders);
      setMapping(detectMapping(nextHeaders));
      setMessage(`อ่านไฟล์แล้ว ${firstRows.length.toLocaleString("th-TH")} แถว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      event.target.value = "";
    }
  }

  function changeSheet(name: string) {
    const rows = workbookRows[name] || [];
    const nextHeaders = Object.keys(rows[0] || {});
    setActiveSheet(name);
    setHeaders(nextHeaders);
    setMapping(detectMapping(nextHeaders));
    setMessage(`เลือกชีต ${name}: ${rows.length.toLocaleString("th-TH")} แถว`);
  }

  async function importRows() {
    if (missingPlate || !parsedRows.length) return;

    setImporting(true);
    setError("");
    setMessage("");
    setProgress(0);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let importedAt = "";

    try {
      for (let start = 0; start < parsedRows.length; start += chunkSize) {
        const chunk = parsedRows.slice(start, start + chunkSize);
        const data = await api<{ result: StockImportResult }>("/api/stock/import", {
          method: "POST",
          body: JSON.stringify({ rows: chunk, sourceName: fileName })
        });
        imported += data.result.imported;
        updated += data.result.updated;
        skipped += data.result.skipped;
        importedAt = data.result.importedAt || importedAt;
        setProgress(Math.round(Math.min(((start + chunk.length) / parsedRows.length) * 100, 100)));
      }

      setMessage(`Import สำเร็จ: เพิ่ม ${imported} / อัปเดต ${updated} / ข้าม ${skipped}`);
      setStatus((current) => ({
        total: current.total + imported,
        latestImportedAt: importedAt,
        latestUpdatedAt: importedAt
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import ไม่สำเร็จ");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">Import Stock</h1>
          <p className="mt-1 text-sm text-soft">อ่าน Excel/CSV ครั้งเดียว แล้วบันทึกเข้า StockInventory สำหรับค้นทะเบียนเร็ว</p>
        </div>
        <Link
          href="/booking-reports"
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
        >
          <ArrowLeft size={18} className="text-brand" aria-hidden="true" />
          รายงานจอง
        </Link>
      </header>

      {(message || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error ? "border-amber-400/40 bg-amber-950/30 text-amber-100" : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          {error ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{error || message}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-4">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Database size={18} className="text-brand" />
              สต๊อกล่าสุด
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="จำนวนใน StockInventory" value={`${status.total.toLocaleString("th-TH")} คัน`} />
              <Stat label="Import ล่าสุด" value={status.latestImportedAt || "-"} />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <FileSpreadsheet size={18} className="text-brand" />
              เลือกไฟล์
            </h2>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-brand/50 bg-[#0b0d11] px-4 py-5 text-center">
              <Upload size={26} className="text-brand" />
              <span className="font-semibold text-white">อัปโหลด Excel / CSV</span>
              <span className="text-xs text-soft">รองรับ .xlsx, .xls, .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="sr-only" />
            </label>
            {fileName && <p className="mt-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-sm text-soft">{fileName}</p>}
          </div>

          {sheetNames.length > 0 && (
            <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">Sheet</span>
                <select
                  value={activeSheet}
                  onChange={(event) => changeSheet(event.target.value)}
                  className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {headers.length > 0 && (
            <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
              <h2 className="mb-3 text-lg font-bold text-white">จับคู่คอลัมน์</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldLabels.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{field.label}</span>
                    <select
                      value={mapping[field.key]}
                      onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
                    >
                      <option value="">ไม่ใช้</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {missingPlate && <p className="mt-3 text-sm text-amber-200">ต้องเลือกคอลัมน์ทะเบียนรถก่อน import</p>}
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Preview</h2>
                  <p className="text-xs text-soft">พบข้อมูลพร้อม import {parsedRows.length.toLocaleString("th-TH")} แถว</p>
                </div>
                <button
                  type="button"
                  disabled={importing || missingPlate || !parsedRows.length}
                  onClick={importRows}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-ink"
                >
                  {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  Import
                </button>
              </div>
              {importing && (
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#0b0d11]">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-[#0b0d11] text-soft">
                    <tr>
                      {fieldLabels.slice(0, 10).map((field) => (
                        <th key={field.key} className="px-3 py-2 font-semibold">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={`${row.plate}-${index}`} className="border-t border-line text-[#dce2eb]">
                        <td className="px-3 py-2">{row.plate}</td>
                        <td className="px-3 py-2">{row.brand}</td>
                        <td className="px-3 py-2">{row.model}</td>
                        <td className="px-3 py-2">{row.year}</td>
                        <td className="px-3 py-2">{row.color}</td>
                        <td className="px-3 py-2">{row.salePrice}</td>
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2">{row.ownership}</td>
                        <td className="px-3 py-2">{row.project}</td>
                        <td className="px-3 py-2">{row.campaign}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <p className="text-xs text-soft">{label}</p>
      <p className="mt-1 break-words text-base font-bold text-white">{value}</p>
    </div>
  );
}
