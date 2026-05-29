"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { PageContainer, PageTitle, TopMenuButton } from "@/app/components/ui";
import type { StockImportResult, StockImportStatus, StockVehicle } from "@/lib/types";

type RawRow = Record<string, unknown>;
type HiddenColumnAction = "import" | "ignore" | "never";
type HiddenColumnInfo = {
  header: string;
  index: number;
  letter: string;
  hidden: boolean;
};

const chunkSize = 300;
const defaultHeaderRow = 5;
const hiddenColumnPolicyStorageKey = "bigcar-stock-hidden-column-policy-v1";
const vinFallbackKey = "__BIGCAR_COL_U";
const vinFallbackLabel = "คอลัมน์ U (ล็อกอัตโนมัติ)";
const vehicleGroupFallbackKey = "__BIGCAR_COL_H";
const vehicleGroupFallbackLabel = "คอลัมน์ H (ล็อกอัตโนมัติ)";
const fieldLabels: Array<{ key: keyof StockVehicle; label: string; aliases: string[] }> = [
  { key: "plate", label: "ทะเบียนรถ", aliases: ["ทะเบียนรถ", "ทะเบียน", "plate", "licenseplate", "regno", "เลขทะเบียน"] },
  { key: "brand", label: "ยี่ห้อรถ", aliases: ["ยี่ห้อรถ", "ยี่ห้อ", "brand", "make"] },
  { key: "model", label: "รุ่นรถ", aliases: ["รุ่นรถ", "รุ่นรถยนต์", "รุ่น", "model"] },
  { key: "year", label: "ปีรถ", aliases: ["ปีรถ", "ปีจด", "ปี", "year", "modelyear"] },
  { key: "color", label: "สีรถ", aliases: ["สีรถ", "สี", "color", "colour"] },
  { key: "salePrice", label: "ราคาตั้งขาย", aliases: ["ราคาตั้งขาย", "ราคาเสนอขายRT", "ราคาเสนอขาย", "ราคา", "price", "saleprice", "sellingprice"] },
  { key: "source", label: "แหล่งที่มา", aliases: ["แหล่งที่มา", "source"] },
  { key: "ownership", label: "กรรมสิทธิ์", aliases: ["กรรมสิทธิ์", "ownership"] },
  { key: "reportReturnDate", label: "วันที่รับรายงานคืน", aliases: ["วันที่รับรายงานคืน", "reportreturndate", "returnedreportdate"] },
  { key: "agingGroup", label: "กลุ่มAging", aliases: ["กลุ่มaging", "กลุ่ม aging", "aginggroup"] },
  { key: "aging", label: "Aging", aliases: ["aging"] },
  { key: "customerName", label: "ชื่อลูกค้า", aliases: ["ชื่อลูกค้า", "customername", "customer"] },
  { key: "project", label: "Project", aliases: ["project", "โปรเจกต์"] },
  { key: "campaign", label: "Campaign", aliases: ["campaign", "แคมเปญ"] },
  { key: "colorGroup", label: "กลุ่มสี", aliases: ["กลุ่มสี", "colorgroup"] },
  { key: "closedSales", label: "Closed Sales", aliases: ["closed sales", "closedsales"] },
  { key: "inspection", label: "Inspection", aliases: ["inspection"] },
  { key: "extendedWarranty", label: "Extended Warranty", aliases: ["extended warranty", "extendedwarranty", "warranty"] },
  { key: "sellerName", label: "ชื่อผู้ขาย", aliases: ["ชื่อผู้ขาย", "salename", "salesname", "sellername"] },
  { key: "bookingSaleDate", label: "วันที่จอง/ขาย", aliases: ["วันที่จอง/ขาย", "วันที่จอง", "วันที่ขาย", "bookingsaledate", "bookingdate", "solddate"] },
  { key: "vin", label: "เลขตัวรถ", aliases: ["เลขตัวรถ", "เลขตัวถัง", "vin", "chassis"] },
  { key: "engineNo", label: "เลขเครื่อง", aliases: ["เลขเครื่อง", "เลขเครื่องยนต์", "engineno", "enginenumber"] },
  { key: "financeName", label: "ไฟแนนซ์", aliases: ["ไฟแนนซ์", "บริษัทไฟแนนซ์", "finance", "financename"] },
  { key: "finalGrade", label: "เกรด Final", aliases: ["เกรด final", "เกรดfinal", "finalgrade", "grade"] },
  { key: "program", label: "Program", aliases: ["program", "PROGRAM"] },
  { key: "parkingLocation", label: "Location", aliases: ["location", "สถานที่จอด", "โลเคชั่น", "parking"] },
  { key: "status", label: "สถานะ", aliases: ["สถานะ", "status"] },
  { key: "gear", label: "เกียร์", aliases: ["เกียร์", "gear", "transmission"] },
  { key: "mileage", label: "เลขไมล์", aliases: ["เลขไมล์", "ไมล์", "mileage", "odo", "odometer"] },
  { key: "pdiStatus", label: "สถานะปรับสภาพ PDI", aliases: ["สถานะปรับสภาพ pdi", "pdistatus", "สถานะ pdi"] },
  { key: "pdiNote", label: "หมายเหตุ PDI", aliases: ["หมายเหตุ pdi", "หมายเหตุPDI", "pdi", "pdinote", "หมายเหตุ"] },
  { key: "vehicleGroup", label: "กลุ่มรถยนต์", aliases: ["กลุ่มรถยนต์", "กลุ่มรถ", "กลุ่ม", "ประเภทรถ", "ประเภท", "vehiclegroup", "cartype", "segment"] }
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

function columnLetter(index: number) {
  return XLSX.utils.encode_col(index);
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function yearOnly(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return String(value.getFullYear());
  }

  if (typeof value === "number" && value > 25000 && value < 60000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y) return String(parsed.y);
  }

  const text = cell(value);
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return match[0];

  const numeric = Number(text);
  if (numeric > 25000 && numeric < 60000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed?.y) return String(parsed.y);
  }

  return text.replace(/[^\d]/g, "").slice(-4);
}

function readHiddenColumnPolicy() {
  try {
    const raw = window.localStorage.getItem(hiddenColumnPolicyStorageKey);
    return raw ? JSON.parse(raw) as Record<string, HiddenColumnAction> : {};
  } catch {
    return {};
  }
}

function writeHiddenColumnPolicy(policy: Record<string, HiddenColumnAction>) {
  window.localStorage.setItem(hiddenColumnPolicyStorageKey, JSON.stringify(policy));
}

function headerPolicyKey(header: string) {
  return normalizeHeader(header);
}

function detectMapping(headers: string[], hiddenColumns: HiddenColumnInfo[] = [], hiddenActions: Record<string, HiddenColumnAction> = {}) {
  const hiddenHeaderKeys = new Set(hiddenColumns.map((column) => headerPolicyKey(column.header)));
  const selectableHeaders = headers.filter((header) => {
    const key = headerPolicyKey(header);
    if (!hiddenHeaderKeys.has(key)) return true;
    return hiddenActions[key] === "import";
  });
  const normalized = selectableHeaders.map((header) => ({ header, normalized: normalizeHeader(header) }));

  return fieldLabels.reduce<Record<keyof StockVehicle, string>>((mapping, field) => {
    const found = normalized.find((item) => field.aliases.some((alias) => item.normalized === normalizeHeader(alias)));
    mapping[field.key] = found?.header || (field.key === "vin" ? vinFallbackKey : field.key === "vehicleGroup" ? vehicleGroupFallbackKey : "");
    return mapping;
  }, {} as Record<keyof StockVehicle, string>);
}

function detectHiddenColumns(sheet: XLSX.WorkSheet | undefined, headerRow: number): HiddenColumnInfo[] {
  if (!sheet) return [];
  const range = XLSX.utils.decode_range(String(sheet["!ref"] || "A1:A1"));
  const cols = sheet["!cols"] || [];
  const output: HiddenColumnInfo[] = [];

  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const metadata = cols[c] as XLSX.ColInfo | undefined;
    if (!metadata?.hidden) continue;
    const header = cell(sheet[XLSX.utils.encode_cell({ c, r: Math.max(headerRow - 1, 0) })]?.v) || `คอลัมน์ ${columnLetter(c)}`;
    output.push({ header, index: c, letter: columnLetter(c), hidden: true });
  }

  return output;
}

function detectHiddenRows(sheet: XLSX.WorkSheet | undefined) {
  return (sheet?.["!rows"] || []).filter((row) => row?.hidden).length;
}

function mapRows(rows: RawRow[], mapping: Record<keyof StockVehicle, string>, importedHiddenHeaders: string[] = []) {
  const mappedHeaders = new Set(Object.values(mapping).filter((value) => value && !String(value).startsWith("__BIGCAR_")));

  return rows
    .map((row) => {
      const extraFields = importedHiddenHeaders.reduce<Record<string, string>>((fields, header) => {
        if (!header || mappedHeaders.has(header)) return fields;
        const value = cell(row[header]);
        if (value) fields[header] = value;
        return fields;
      }, {});

      return {
        plate: cell(row[mapping.plate]),
        brand: cell(row[mapping.brand]),
        model: cell(row[mapping.model]),
        year: yearOnly(row[mapping.year]),
        color: cell(row[mapping.color]),
        salePrice: cell(row[mapping.salePrice]).replace(/[^\d.]/g, ""),
        source: cell(row[mapping.source]),
        ownership: cell(row[mapping.ownership]),
        reportReturnDate: cell(row[mapping.reportReturnDate]),
        agingGroup: cell(row[mapping.agingGroup]),
        aging: cell(row[mapping.aging]),
        customerName: cell(row[mapping.customerName]),
        project: cell(row[mapping.project]),
        campaign: cell(row[mapping.campaign]),
        colorGroup: cell(row[mapping.colorGroup]),
        closedSales: cell(row[mapping.closedSales]),
        inspection: cell(row[mapping.inspection]),
        extendedWarranty: cell(row[mapping.extendedWarranty]),
        sellerName: cell(row[mapping.sellerName]),
        bookingSaleDate: cell(row[mapping.bookingSaleDate]),
        vin: cell(row[mapping.vin]) || cell(row[vinFallbackKey]),
        engineNo: cell(row[mapping.engineNo]),
        financeName: cell(row[mapping.financeName]),
        finalGrade: cell(row[mapping.finalGrade]),
        program: cell(row[mapping.program]),
        parkingLocation: cell(row[mapping.parkingLocation]),
        status: cell(row[mapping.status]),
        gear: cell(row[mapping.gear]),
        mileage: cell(row[mapping.mileage]).replace(/[^\d.]/g, ""),
        pdiStatus: cell(row[mapping.pdiStatus]),
        pdiNote: cell(row[mapping.pdiNote]),
        vehicleGroup: cell(row[mapping.vehicleGroup]) || cell(row[vehicleGroupFallbackKey]),
        extraFields
      };
    })
    .filter((row) => row.plate);
}

function readSheetRows(sheet: XLSX.WorkSheet | undefined, headerRow: number) {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    range: Math.max(headerRow - 1, 0)
  });

  return rows.map((row, index) => {
    const rowNumber = typeof row.__rowNum__ === "number" ? row.__rowNum__ : headerRow + index;
    return {
      ...row,
      [vehicleGroupFallbackKey]: cell(sheet[XLSX.utils.encode_cell({ c: 7, r: rowNumber })]?.v),
      [vinFallbackKey]: cell(sheet[XLSX.utils.encode_cell({ c: 20, r: rowNumber })]?.v)
    };
  });
}

export default function StockImportPage() {
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [workbookSheets, setWorkbookSheets] = useState<Record<string, XLSX.WorkSheet>>({});
  const [workbookRows, setWorkbookRows] = useState<Record<string, RawRow[]>>({});
  const [hiddenColumnsBySheet, setHiddenColumnsBySheet] = useState<Record<string, HiddenColumnInfo[]>>({});
  const [hiddenRowsBySheet, setHiddenRowsBySheet] = useState<Record<string, number>>({});
  const [hiddenColumnActions, setHiddenColumnActions] = useState<Record<string, HiddenColumnAction>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<keyof StockVehicle, string>>(detectMapping([]));
  const [headerRow, setHeaderRow] = useState(defaultHeaderRow);
  const [status, setStatus] = useState<StockImportStatus>({ total: 0, latestImportedAt: "", latestUpdatedAt: "" });
  const [clearExisting, setClearExisting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeHiddenColumns = useMemo(() => hiddenColumnsBySheet[activeSheet] || [], [activeSheet, hiddenColumnsBySheet]);
  const activeHiddenRows = useMemo(() => hiddenRowsBySheet[activeSheet] || 0, [activeSheet, hiddenRowsBySheet]);
  const visibleHeaders = useMemo(() => {
    const hiddenHeaderKeys = new Set(activeHiddenColumns.map((column) => headerPolicyKey(column.header)));
    return headers.filter((header) => !hiddenHeaderKeys.has(headerPolicyKey(header)) || hiddenColumnActions[headerPolicyKey(header)] === "import");
  }, [activeHiddenColumns, headers, hiddenColumnActions]);
  const importedHiddenCount = useMemo(
    () => activeHiddenColumns.filter((column) => hiddenColumnActions[headerPolicyKey(column.header)] === "import").length,
    [activeHiddenColumns, hiddenColumnActions]
  );
  const importedHiddenHeaders = useMemo(
    () => activeHiddenColumns.filter((column) => hiddenColumnActions[headerPolicyKey(column.header)] === "import").map((column) => column.header),
    [activeHiddenColumns, hiddenColumnActions]
  );
  const parsedRows = useMemo(() => mapRows(workbookRows[activeSheet] || [], mapping, importedHiddenHeaders), [activeSheet, importedHiddenHeaders, mapping, workbookRows]);
  const previewRows = parsedRows.slice(0, 8);
  const missingPlate = !mapping.plate;
  const parsedVinCount = useMemo(() => parsedRows.filter((row) => row.vin).length, [parsedRows]);
  const parsedStatusCount = useMemo(() => parsedRows.filter((row) => row.status).length, [parsedRows]);
  const parsedVehicleGroupCount = useMemo(() => parsedRows.filter((row) => row.vehicleGroup).length, [parsedRows]);
  const parsedPdiNoteCount = useMemo(() => parsedRows.filter((row) => row.pdiNote).length, [parsedRows]);

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
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false, cellStyles: true });
      const nextSheets: Record<string, XLSX.WorkSheet> = {};
      const nextRows: Record<string, RawRow[]> = {};
      const nextHiddenColumns: Record<string, HiddenColumnInfo[]> = {};
      const nextHiddenRows: Record<string, number> = {};
      const savedPolicy = readHiddenColumnPolicy();

      workbook.SheetNames.forEach((name) => {
        const sheet = workbook.Sheets[name];
        nextSheets[name] = sheet;
        nextRows[name] = readSheetRows(sheet, headerRow);
        nextHiddenColumns[name] = detectHiddenColumns(sheet, headerRow);
        nextHiddenRows[name] = detectHiddenRows(sheet);
      });

      const firstSheet = workbook.SheetNames[0] || "";
      const firstRows = nextRows[firstSheet] || [];
      const nextHeaders = Object.keys(firstRows[0] || {});

      setSheetNames(workbook.SheetNames);
      setActiveSheet(firstSheet);
      setWorkbookSheets(nextSheets);
      setWorkbookRows(nextRows);
      setHiddenColumnsBySheet(nextHiddenColumns);
      setHiddenRowsBySheet(nextHiddenRows);
      setHiddenColumnActions((current) => {
        const next = { ...savedPolicy, ...current };
        Object.values(nextHiddenColumns).flat().forEach((column) => {
          const key = headerPolicyKey(column.header);
          if (!next[key]) next[key] = "ignore";
        });
        return next;
      });
      setHeaders(nextHeaders);
      setMapping(detectMapping(nextHeaders, nextHiddenColumns[firstSheet] || [], savedPolicy));
      const hiddenCount = Object.values(nextHiddenColumns).flat().length;
      setMessage(`อ่านไฟล์แล้ว ${firstRows.length.toLocaleString("th-TH")} แถว${hiddenCount ? ` / พบ Hidden Column ${hiddenCount.toLocaleString("th-TH")} คอลัมน์` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      event.target.value = "";
    }
  }

  function changeSheet(name: string) {
    const rows = readSheetRows(workbookSheets[name], headerRow);
    setWorkbookRows((current) => ({ ...current, [name]: rows }));
    const nextHeaders = Object.keys(rows[0] || {});
    setActiveSheet(name);
    setHeaders(nextHeaders);
    setMapping(detectMapping(nextHeaders, hiddenColumnsBySheet[name] || [], hiddenColumnActions));
    setMessage(`เลือกชีต ${name}: ${rows.length.toLocaleString("th-TH")} แถว`);
  }

  function changeHeaderRow(value: string) {
    const nextHeaderRow = Math.max(Number(value) || defaultHeaderRow, 1);
    const nextRows = readSheetRows(workbookSheets[activeSheet], nextHeaderRow);
    const nextHiddenColumns = detectHiddenColumns(workbookSheets[activeSheet], nextHeaderRow);
    const nextHeaders = Object.keys(nextRows[0] || {});

    setHeaderRow(nextHeaderRow);
    setWorkbookRows((current) => ({ ...current, [activeSheet]: nextRows }));
    setHiddenColumnsBySheet((current) => ({ ...current, [activeSheet]: nextHiddenColumns }));
    setHeaders(nextHeaders);
    setMapping(detectMapping(nextHeaders, nextHiddenColumns, hiddenColumnActions));
    if (activeSheet) {
      setMessage(`อ่านหัวตารางจากแถว ${nextHeaderRow}: ${nextRows.length.toLocaleString("th-TH")} แถว`);
    }
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
    let clientVinRows = 0;
    let clientStatusRows = 0;
    let clientVehicleGroupRows = 0;
    let clientPdiNoteRows = 0;
    let vinReceived = 0;
    let vinWritten = 0;
    let pdiReceived = 0;
    let pdiWritten = 0;
    let importedAt = "";

    try {
      if (clearExisting) {
        const confirmed = window.confirm("ล้าง StockInventory เดิมทั้งหมด แล้ว import ไฟล์นี้ใหม่ใช่ไหม?");
        if (!confirmed) {
          setImporting(false);
          return;
        }
      }

      for (let start = 0; start < parsedRows.length; start += chunkSize) {
        const chunk = parsedRows.slice(start, start + chunkSize);
        const data = await api<{ result: StockImportResult }>("/api/stock/import", {
          method: "POST",
          body: JSON.stringify({ rows: chunk, sourceName: fileName, clearExisting: clearExisting && start === 0 })
        });
        imported += data.result.imported;
        updated += data.result.updated;
        skipped += data.result.skipped;
        clientVinRows += data.result.clientVinRows || 0;
        clientStatusRows += data.result.clientStatusRows || 0;
        clientVehicleGroupRows += data.result.clientVehicleGroupRows || 0;
        clientPdiNoteRows += data.result.clientPdiNoteRows || 0;
        vinReceived += data.result.vinReceived || 0;
        vinWritten += data.result.vinWritten || 0;
        pdiReceived += data.result.pdiReceived || 0;
        pdiWritten += data.result.pdiWritten || 0;
        importedAt = data.result.importedAt || importedAt;
        setProgress(Math.round(Math.min(((start + chunk.length) / parsedRows.length) * 100, 100)));
      }

      setMessage(
        `Import สำเร็จ: เพิ่ม ${imported} / อัปเดต ${updated} / ข้าม ${skipped} / เลขตัวรถ ${clientVinRows} / สถานะ ${clientStatusRows} / กลุ่มรถยนต์ ${clientVehicleGroupRows} / หมายเหตุ PDI ${clientPdiNoteRows} / Apps Script รับ PDI ${pdiReceived} / เขียน ${pdiWritten} / รับเลขตัวรถ ${vinReceived} / เขียน ${vinWritten}`
      );
      setStatus((current) => ({
        total: clearExisting ? imported : current.total + imported,
        latestImportedAt: importedAt,
        latestUpdatedAt: importedAt
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import ไม่สำเร็จ");
    } finally {
      setImporting(false);
    }
  }

  function setHiddenColumnAction(column: HiddenColumnInfo, action: HiddenColumnAction) {
    const key = headerPolicyKey(column.header);
    setHiddenColumnActions((current) => {
      const next = { ...current, [key]: action };
      if (action === "never") writeHiddenColumnPolicy(next);
      return next;
    });
    setMapping((current) => {
      if (action === "import") return current;
      const next = { ...current };
      (Object.keys(next) as Array<keyof StockVehicle>).forEach((field) => {
        if (next[field] === column.header) next[field] = "";
      });
      return next;
    });
  }

  function resetNeverImportPolicy() {
    writeHiddenColumnPolicy({});
    setHiddenColumnActions((current) => {
      const next = { ...current };
      activeHiddenColumns.forEach((column) => {
        const key = headerPolicyKey(column.header);
        if (next[key] === "never") next[key] = "ignore";
      });
      return next;
    });
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="อัปโหลดสต็อก"
        subtitle="อ่าน Excel/CSV ครั้งเดียว แล้วบันทึกเข้า StockInventory สำหรับค้นทะเบียนเร็ว"
        actions={
          <TopMenuButton href="/settings" icon={<ArrowLeft size={18} />}>
            กลับ
          </TopMenuButton>
        }
      />

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
              <label className="mb-3 block">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">แถวหัวตาราง</span>
                <input
                  value={headerRow}
                  onChange={(event) => changeHeaderRow(event.target.value)}
                  inputMode="numeric"
                  className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
                />
                <span className="mt-1 block text-xs text-soft">ไฟล์ Big Car ใช้แถว 5 เพราะคำว่า ทะเบียน อยู่ที่ I5</span>
              </label>
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

          {headers.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-4 shadow-glow">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(event) => setClearExisting(event.target.checked)}
                  className="mt-1 h-5 w-5 accent-brand"
                />
                <span>
                  <span className="block font-bold text-amber-100">ล้าง StockInventory เดิมก่อน Import</span>
                  <span className="mt-1 block text-sm leading-6 text-amber-100/80">
                    ใช้เมื่อไฟล์นี้เป็นสต๊อกล่าสุดครบทั้งร้าน ระบบจะล้างเฉพาะแท็บ StockInventory ไม่กระทบลูกค้าและรายงานจอง
                  </span>
                </span>
              </label>
            </div>
          )}

          {activeHiddenColumns.length > 0 && (
            <div className="rounded-lg border border-brand/30 bg-green-950/10 p-4 shadow-glow">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <FileSpreadsheet size={18} className="text-brand" />
                    Hidden Columns
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-soft">
                    พบคอลัมน์ซ่อน {activeHiddenColumns.length.toLocaleString("th-TH")} คอลัมน์
                    {activeHiddenRows ? ` / แถวซ่อน ${activeHiddenRows.toLocaleString("th-TH")} แถว` : ""} ค่าเริ่มต้นคือไม่ import และไม่แสดงใน Preview/Export
                  </p>
                </div>
                <button type="button" onClick={resetNeverImportPolicy} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-bold text-white">
                  Reset Never
                </button>
              </div>
              <div className="space-y-2">
                {activeHiddenColumns.map((column) => {
                  const key = headerPolicyKey(column.header);
                  const action = hiddenColumnActions[key] || "ignore";
                  return (
                    <div key={`${column.letter}-${column.header}`} className="rounded-lg border border-line bg-[#0b0d11] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{column.header}</p>
                          <p className="mt-0.5 text-xs text-soft">Column {column.letter} · default hidden</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            ["import", "Import"],
                            ["ignore", "Ignore"],
                            ["never", "Never"]
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setHiddenColumnAction(column, value as HiddenColumnAction)}
                              className={`min-h-9 rounded-md border px-2 text-xs font-black ${
                                action === value ? "border-brand bg-brand text-ink" : "border-line bg-panel text-white"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {importedHiddenCount > 0 && (
                <p className="mt-3 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand">
                  นำเข้า hidden column แล้ว {importedHiddenCount.toLocaleString("th-TH")} คอลัมน์ ตอนนี้เลือกใช้ใน mapping ได้ แต่จะไม่แสดง Preview/Export อัตโนมัติจนกว่าจะเลือกคอลัมน์เอง
                </p>
              )}
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
                      {field.key === "vin" && <option value={vinFallbackKey}>{vinFallbackLabel}</option>}
                      {field.key === "vehicleGroup" && <option value={vehicleGroupFallbackKey}>{vehicleGroupFallbackLabel}</option>}
                      {visibleHeaders.map((header) => (
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
                  <p className="mt-1 text-xs text-soft">
                    เลขตัวรถ {parsedVinCount.toLocaleString("th-TH")} / สถานะ {parsedStatusCount.toLocaleString("th-TH")} / กลุ่มรถยนต์{" "}
                    {parsedVehicleGroupCount.toLocaleString("th-TH")} / หมายเหตุ PDI {parsedPdiNoteCount.toLocaleString("th-TH")} แถว
                  </p>
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
                      {fieldLabels.map((field) => (
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
                        <td className="px-3 py-2">{row.vin}</td>
                        <td className="px-3 py-2">{row.finalGrade}</td>
                        <td className="px-3 py-2">{row.program}</td>
                        <td className="px-3 py-2">{row.parkingLocation}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="px-3 py-2">{row.gear}</td>
                        <td className="px-3 py-2">{row.mileage}</td>
                        <td className="px-3 py-2">{row.pdiNote}</td>
                        <td className="px-3 py-2">{row.vehicleGroup}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
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
