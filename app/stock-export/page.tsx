"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileImage, Filter, Loader2, Search, Upload } from "lucide-react";
import {
  ActiveFilterTag,
  BottomSheet,
  FilterChip,
  FilterSummaryPill,
  PageContainer,
  PageTitle,
  SearchField,
  SectionCard,
  StickyFilterBar,
  TopMenuButton
} from "@/app/components/ui";
import type { StockVehicle } from "@/lib/types";

type StockListResponse = {
  vehicles: StockVehicle[];
  total: number;
  warning?: string;
};

const maxTableItems = 20;
const stockStatuses = ["รอขาย", "เตรียมส่งลาน", "จอง_Sale", "จอง_Internal", "จอง_รถทดแทน", "ขายแล้ว"];
const ENABLE_NEW_STOCK_UI = process.env.NEXT_PUBLIC_ENABLE_NEW_STOCK_UI !== "false";

type ExportMode = "customer" | "internal";
type ExportFormat = "png" | "jpeg" | "pdf";

type StockExportGroup = {
  name: string;
  pages: StockVehicle[][];
  vehicles: StockVehicle[];
};

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type AdvancedStockFilters = {
  location: string;
  year: string;
  model: string;
  gear: string;
  color: string;
  plate: string;
  mileageMin: string;
  mileageMax: string;
  priceMin: string;
  priceMax: string;
};

const emptyAdvancedFilters: AdvancedStockFilters = {
  location: "",
  year: "",
  model: "",
  gear: "",
  color: "",
  plate: "",
  mileageMin: "",
  mileageMax: "",
  priceMin: "",
  priceMax: ""
};

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function formatPrice(value: string) {
  const numeric = Number(String(value || "").replace(/[^\d.]/g, ""));
  if (!numeric) return "-";
  return `${numeric.toLocaleString("th-TH")} บาท`;
}

function formatMileage(value?: string) {
  const numeric = Number(String(value || "").replace(/[^\d.]/g, ""));
  if (!numeric) return "-";
  return `${numeric.toLocaleString("th-TH")} กม.`;
}

function parseNumeric(value?: string) {
  return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
}

function vehicleTitle(vehicle: StockVehicle) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "-";
}

function stockStatus(vehicle: StockVehicle) {
  return String(vehicle.status || "").trim();
}

function stockVehicleGroup(vehicle: StockVehicle) {
  return String(vehicle.vehicleGroup || "").trim();
}

function shortLocation(value?: string) {
  return String(value || "-")
    .replace("โกดัง-", "")
    .replace("สาขา", "")
    .trim() || "-";
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));
}

function countAdvancedFilters(filters: AdvancedStockFilters) {
  return Object.values(filters).filter((value) => String(value || "").trim()).length;
}

function matchesAdvancedFilters(vehicle: StockVehicle, filters: AdvancedStockFilters) {
  return matchesAdvancedFiltersExcept(vehicle, filters, []);
}

function matchesAdvancedFiltersExcept(vehicle: StockVehicle, filters: AdvancedStockFilters, except: (keyof AdvancedStockFilters)[]) {
  const ignored = new Set<keyof AdvancedStockFilters>(except);
  if (!ignored.has("location") && filters.location && vehicle.parkingLocation !== filters.location) return false;
  if (!ignored.has("year") && filters.year && vehicle.year !== filters.year) return false;
  if (!ignored.has("model") && filters.model && !normalizeText(vehicleTitle(vehicle)).includes(normalizeText(filters.model))) return false;
  if (!ignored.has("gear") && filters.gear && vehicle.gear !== filters.gear) return false;
  if (!ignored.has("color") && filters.color && vehicle.color !== filters.color) return false;
  if (!ignored.has("plate") && filters.plate && !normalizePlate(vehicle.plate).includes(normalizePlate(filters.plate))) return false;

  const mileage = parseNumeric(vehicle.mileage);
  const mileageMin = parseNumeric(filters.mileageMin);
  const mileageMax = parseNumeric(filters.mileageMax);
  if (!ignored.has("mileageMin") && mileageMin && mileage < mileageMin) return false;
  if (!ignored.has("mileageMax") && mileageMax && mileage > mileageMax) return false;

  const price = parseNumeric(vehicle.salePrice);
  const priceMin = parseNumeric(filters.priceMin);
  const priceMax = parseNumeric(filters.priceMax);
  if (!ignored.has("priceMin") && priceMin && price < priceMin) return false;
  if (!ignored.has("priceMax") && priceMax && price > priceMax) return false;

  return true;
}

function safeFilePart(value: string) {
  return String(value || "stock")
    .replace(/[\\/:*?"<>|#\[\]]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "stock";
}

function fileName(groupName: string, extension: "png" | "jpg", page?: number, totalPages?: number) {
  const date = new Date().toISOString().slice(0, 10);
  const group = safeFilePart(groupName);
  if (page && totalPages && totalPages > 1) return `big-car-stock-${group}-${date}-page-${page}-of-${totalPages}.${extension}`;
  return `big-car-stock-${group}-${date}.${extension}`;
}

function pdfFileName(groupCount: number) {
  const date = new Date().toISOString().slice(0, 10);
  return `big-car-stock-${groupCount.toLocaleString("en-US")}-groups-${date}.pdf`;
}

export default function StockExportPage() {
  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedVehicleGroups, setSelectedVehicleGroups] = useState<string[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedStockFilters>(emptyAdvancedFilters);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("customer");
  const [listOpen, setListOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const importedStatusCount = useMemo(() => vehicles.filter((vehicle) => stockStatus(vehicle)).length, [vehicles]);
  const importedVehicleGroupCount = useMemo(() => vehicles.filter((vehicle) => stockVehicleGroup(vehicle)).length, [vehicles]);

  const plateMatchedVehicles = useMemo(() => {
    const search = query.toLowerCase().replace(/\s+/g, "");
    const byPlate = new Map<string, StockVehicle>();

    vehicles.forEach((vehicle) => {
      const plateKey = normalizePlate(vehicle.plate);
      if (!plateKey || byPlate.has(plateKey)) return;
      if (search) {
        const hay = [
          vehicle.plate,
          vehicle.brand,
          vehicle.model,
          vehicle.year,
          vehicle.color,
          vehicle.status,
          vehicle.gear,
          vehicle.mileage,
          vehicle.salePrice,
          vehicle.parkingLocation,
          vehicle.project,
          vehicle.program,
          vehicle.vehicleGroup
        ]
          .join("")
          .toLowerCase()
          .replace(/\s+/g, "");
        if (!hay.includes(search)) return;
      }
      byPlate.set(plateKey, vehicle);
    });

    return Array.from(byPlate.values());
  }, [query, vehicles]);

  const statusMatchedVehicles = useMemo(() => {
    return plateMatchedVehicles.filter((vehicle) => {
      const status = stockStatus(vehicle);
      return !selectedStatuses.length || !importedStatusCount || selectedStatuses.includes(status);
    });
  }, [importedStatusCount, plateMatchedVehicles, selectedStatuses]);

  const groupMatchedVehicles = useMemo(() => {
    return statusMatchedVehicles.filter((vehicle) => {
      const group = stockVehicleGroup(vehicle) || "ไม่ระบุ";
      return !selectedVehicleGroups.length || selectedVehicleGroups.includes(group);
    });
  }, [selectedVehicleGroups, statusMatchedVehicles]);

  const filteredVehicles = useMemo(() => {
    return groupMatchedVehicles.filter((vehicle) => matchesAdvancedFilters(vehicle, advancedFilters));
  }, [advancedFilters, groupMatchedVehicles]);

  const advancedOptions = useMemo(() => {
    const optionValues = (except: (keyof AdvancedStockFilters)[]) => {
      return groupMatchedVehicles.filter((vehicle) => matchesAdvancedFiltersExcept(vehicle, advancedFilters, except));
    };
    const locationVehicles = optionValues(["location"]);
    const yearVehicles = optionValues(["year"]);
    const modelVehicles = optionValues(["model"]);
    const gearVehicles = optionValues(["gear"]);
    const colorVehicles = optionValues(["color"]);

    return {
      locations: uniqueSorted(locationVehicles.map((vehicle) => vehicle.parkingLocation || "")),
      years: uniqueSorted(yearVehicles.map((vehicle) => vehicle.year || "")),
      models: uniqueSorted(modelVehicles.map((vehicle) => vehicleTitle(vehicle))),
      gears: uniqueSorted(gearVehicles.map((vehicle) => vehicle.gear || "")),
      colors: uniqueSorted(colorVehicles.map((vehicle) => vehicle.color || ""))
    };
  }, [advancedFilters, groupMatchedVehicles]);

  const advancedFilterCount = useMemo(() => countAdvancedFilters(advancedFilters), [advancedFilters]);

  const statusCounts = useMemo(() => {
    return plateMatchedVehicles.reduce<Record<string, number>>((counts, vehicle) => {
      const status = stockStatus(vehicle) || "ไม่ระบุ";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }, [plateMatchedVehicles]);

  const statusOptions = useMemo(() => {
    return stockStatuses.filter((status) => (statusCounts[status] || 0) > 0 || selectedStatuses.includes(status));
  }, [selectedStatuses, statusCounts]);

  const vehicleGroupOptions = useMemo(() => {
    const counts = statusMatchedVehicles.reduce<Record<string, number>>((nextCounts, vehicle) => {
      const group = stockVehicleGroup(vehicle);
      if (group) nextCounts[group] = (nextCounts[group] || 0) + 1;
      return nextCounts;
    }, {});

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [statusMatchedVehicles]);

  const exportVehicles = filteredVehicles;
  const exportGroups = useMemo(() => groupVehiclesForExport(exportVehicles), [exportVehicles]);
  const exportPageCount = useMemo(() => exportGroups.reduce((total, group) => total + group.pages.length, 0), [exportGroups]);
  const visibleVehicles = useMemo(() => filteredVehicles.slice(0, visibleCount), [filteredVehicles, visibleCount]);
  const hasMoreVehicles = filteredVehicles.length > visibleCount;

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    const availableGroups = new Set(vehicleGroupOptions.map((group) => group.name));
    setSelectedVehicleGroups((current) => current.filter((group) => availableGroups.has(group)));
  }, [vehicleGroupOptions]);

  useEffect(() => {
    setVisibleCount(20);
  }, [advancedFilters, query, selectedStatuses, selectedVehicleGroups]);

  async function loadStock() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await api<StockListResponse>("/api/stock/list?limit=500");
      setVehicles(data.vehicles);
      if (data.warning) setError(`${data.warning} - ถ้าเพิ่งเพิ่มฟีเจอร์นี้ ต้อง deploy Apps Script เวอร์ชันใหม่ก่อน`);
      else setMessage(`โหลดสต็อก ${data.total.toLocaleString("th-TH")} คันแล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสต็อกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setSelectedStatuses([]);
    setSelectedVehicleGroups([]);
    setAdvancedFilters(emptyAdvancedFilters);
  }

  function setAdvancedFilter<K extends keyof AdvancedStockFilters>(key: K, value: AdvancedStockFilters[K]) {
    setAdvancedFilters((current) => ({ ...current, [key]: value }));
  }

  function clearAdvancedFilter(key: keyof AdvancedStockFilters) {
    setAdvancedFilters((current) => ({ ...current, [key]: "" }));
  }

  async function exportImage(format: ExportFormat) {
    setExporting(true);
    setError("");
    setMessage(`กำลังสร้างไฟล์ ${format.toUpperCase()} ${exportPageCount.toLocaleString("th-TH")} หน้า...`);

    try {
      if (!exportVehicles.length) throw new Error("ยังไม่มีรถตามตัวกรองสำหรับ Export");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");
      const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      const extension = format === "jpeg" ? "jpg" : "png";
      const files: File[] = [];
      const pdfImages: PdfImage[] = [];

      for (const group of exportGroups) {
        for (let index = 0; index < group.pages.length; index += 1) {
          renderStockTableCanvas(canvas, group.pages[index], exportMode, index + 1, group.pages.length, group.name, group.vehicles.length, exportVehicles.length);
          if (format === "pdf") {
            const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
            pdfImages.push({ bytes: new Uint8Array(await jpegBlob.arrayBuffer()), width: canvas.width, height: canvas.height });
          } else {
            const blob = await canvasToBlob(canvas, mimeType, format === "jpeg" ? 0.92 : undefined);
            files.push(new File([blob], fileName(group.name, extension, index + 1, group.pages.length), { type: mimeType }));
          }
        }
      }

      if (format === "pdf") {
        const blob = buildPdfFromJpegs(pdfImages);
        files.push(new File([blob], pdfFileName(exportGroups.length), { type: "application/pdf" }));
      }

      const shareData = {
        title: "ตารางสต็อก BIG CAR",
        text: `ตารางสต็อก ${exportVehicles.length.toLocaleString("th-TH")} คัน / ${exportGroups.length.toLocaleString("th-TH")} กลุ่ม / ${files.length.toLocaleString("th-TH")} ไฟล์`,
        files
      };

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setMessage(`เปิดเมนูเซฟ/แชร์แล้ว ${files.length.toLocaleString("th-TH")} ไฟล์`);
        return;
      }

      for (let index = 0; index < files.length; index += 1) {
        const url = URL.createObjectURL(files[index]);
        const link = document.createElement("a");
        link.href = url;
        link.download = files[index].name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }

      setMessage(`Export ${format.toUpperCase()} แล้ว ${files.length.toLocaleString("th-TH")} ไฟล์ จาก ${exportPageCount.toLocaleString("th-TH")} หน้า`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  async function copyImage() {
    setExporting(true);
    setError("");
    setMessage("");

    try {
      if (!exportVehicles.length) throw new Error("ยังไม่มีรถตามตัวกรองสำหรับ Copy");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");
      const firstGroup = exportGroups[0];
      renderStockTableCanvas(canvas, firstGroup.pages[0] || firstGroup.vehicles, exportMode, 1, Math.max(firstGroup.pages.length, 1), firstGroup.name, firstGroup.vehicles.length, exportVehicles.length);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("เครื่องนี้ยังไม่รองรับ Copy Image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage(exportPageCount > 1 ? "Copy รูปแรกของกลุ่มแรกแล้ว ถ้ามีหลายรูปให้ใช้เซฟ PNG" : "Copy รูปสต็อกแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy รูปไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="สร้างรูปสต็อก"
        subtitle="เลือกสต็อกแล้ว Export เป็นรูปสำหรับส่งต่อได้ทันที"
        actions={
          <>
            <TopMenuButton href="/stock-import" icon={<Upload size={18} />}>
              Import
            </TopMenuButton>
            <TopMenuButton href="/" icon={<ArrowLeft size={18} />}>
              หน้าแรก
            </TopMenuButton>
          </>
        }
      />

      {(message || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error ? "border-amber-400/40 bg-amber-950/30 text-amber-100" : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          {loading ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{error || message}</span>
        </div>
      )}

      <div className="space-y-4">
          <SectionCard title="ค้นหาและกรองสต็อก" icon={<Search size={18} />}>
            {ENABLE_NEW_STOCK_UI ? (
              <StickyFilterBar>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <SearchField
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นทะเบียน / รุ่น / ปี / Location"
                    icon={<Search size={18} />}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen(true)}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-4 font-semibold text-white transition hover:border-brand/60"
                    >
                      <Filter size={18} className="text-brand" />
                      Filter{advancedFilterCount ? ` (${advancedFilterCount})` : ""}
                    </button>
                    <button type="button" onClick={clearFilters} className="min-h-12 rounded-lg border border-line bg-[#0b0d11] px-4 font-semibold text-white transition hover:border-brand/60">
                      ล้างตัวกรอง
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <FilterSummaryPill>พร้อม Export {exportVehicles.length.toLocaleString("th-TH")} คัน</FilterSummaryPill>
                  <FilterSummaryPill>ออกเป็น {exportPageCount.toLocaleString("th-TH")} รูป</FilterSummaryPill>
                  <FilterSummaryPill>แยก {exportGroups.length.toLocaleString("th-TH")} กลุ่ม</FilterSummaryPill>
                  <FilterSummaryPill>แสดง {filteredVehicles.length.toLocaleString("th-TH")} คัน</FilterSummaryPill>
                  <FilterSummaryPill>มีสถานะ {importedStatusCount.toLocaleString("th-TH")} คัน</FilterSummaryPill>
                  <FilterSummaryPill>มีกลุ่มรถยนต์ {importedVehicleGroupCount.toLocaleString("th-TH")} คัน</FilterSummaryPill>
                </div>
              </StickyFilterBar>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นทะเบียน / รุ่น / ปี / Location"
                    className="h-12 rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
                  />
                  <button type="button" onClick={clearFilters} className="min-h-12 rounded-lg border border-line px-4 font-semibold text-white">
                    ล้างตัวกรอง
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-soft">
                  <span className="rounded-full border border-line px-3 py-1">พร้อม Export {exportVehicles.length.toLocaleString("th-TH")} คัน</span>
                  <span className="rounded-full border border-line px-3 py-1">ออกเป็น {exportPageCount.toLocaleString("th-TH")} รูป</span>
                  <span className="rounded-full border border-line px-3 py-1">แยก {exportGroups.length.toLocaleString("th-TH")} กลุ่ม</span>
                  <span className="rounded-full border border-line px-3 py-1">แสดง {filteredVehicles.length.toLocaleString("th-TH")} คัน</span>
                  <span className="rounded-full border border-line px-3 py-1">มีสถานะ {importedStatusCount.toLocaleString("th-TH")} คัน</span>
                  <span className="rounded-full border border-line px-3 py-1">มีกลุ่มรถยนต์ {importedVehicleGroupCount.toLocaleString("th-TH")} คัน</span>
                </div>
              </>
            )}
            {ENABLE_NEW_STOCK_UI && (query || selectedStatuses.length || selectedVehicleGroups.length || advancedFilterCount) ? (
              <div className="flex flex-wrap gap-2">
                {query && <ActiveFilterTag onRemove={() => setQuery("")}>ค้นหา: {query}</ActiveFilterTag>}
                {selectedStatuses.map((status) => (
                  <ActiveFilterTag key={`status-${status}`} onRemove={() => setSelectedStatuses((current) => current.filter((item) => item !== status))}>
                    {status}
                  </ActiveFilterTag>
                ))}
                {selectedVehicleGroups.map((group) => (
                  <ActiveFilterTag key={`group-${group}`} onRemove={() => setSelectedVehicleGroups((current) => current.filter((item) => item !== group))}>
                    {group}
                  </ActiveFilterTag>
                ))}
                {advancedFilters.location && <ActiveFilterTag onRemove={() => clearAdvancedFilter("location")}>Location: {advancedFilters.location}</ActiveFilterTag>}
                {advancedFilters.year && <ActiveFilterTag onRemove={() => clearAdvancedFilter("year")}>ปี: {advancedFilters.year}</ActiveFilterTag>}
                {advancedFilters.model && <ActiveFilterTag onRemove={() => clearAdvancedFilter("model")}>รุ่น: {advancedFilters.model}</ActiveFilterTag>}
                {advancedFilters.gear && <ActiveFilterTag onRemove={() => clearAdvancedFilter("gear")}>เกียร์: {advancedFilters.gear}</ActiveFilterTag>}
                {advancedFilters.color && <ActiveFilterTag onRemove={() => clearAdvancedFilter("color")}>สี: {advancedFilters.color}</ActiveFilterTag>}
                {advancedFilters.plate && <ActiveFilterTag onRemove={() => clearAdvancedFilter("plate")}>ทะเบียน: {advancedFilters.plate}</ActiveFilterTag>}
                {(advancedFilters.mileageMin || advancedFilters.mileageMax) && (
                  <ActiveFilterTag
                    onRemove={() => setAdvancedFilters((current) => ({ ...current, mileageMin: "", mileageMax: "" }))}
                  >
                    ไมล์: {advancedFilters.mileageMin || "0"}-{advancedFilters.mileageMax || "∞"}
                  </ActiveFilterTag>
                )}
                {(advancedFilters.priceMin || advancedFilters.priceMax) && (
                  <ActiveFilterTag
                    onRemove={() => setAdvancedFilters((current) => ({ ...current, priceMin: "", priceMax: "" }))}
                  >
                    ราคา: {advancedFilters.priceMin || "0"}-{advancedFilters.priceMax || "∞"}
                  </ActiveFilterTag>
                )}
                <button type="button" onClick={clearFilters} className="min-h-8 rounded-full border border-line px-3 text-xs font-bold text-soft transition hover:border-brand hover:text-white">
                  ล้างทั้งหมด
                </button>
              </div>
            ) : null}
            {vehicles.length > 0 && (!importedStatusCount || !importedVehicleGroupCount) && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-950/20 px-3 py-3 text-sm text-amber-100">
                โหลดสต็อกแล้ว แต่ข้อมูลสถานะ/กลุ่มรถยนต์ยังว่างในระบบ ให้ Import Stock ใหม่หลัง Vercel deploy แล้วติ๊ก “ล้าง StockInventory เดิมก่อน Import”
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">สถานะ</p>
                <button type="button" onClick={() => setSelectedStatuses([])} className="text-xs font-semibold text-brand">
                  ทั้งหมด
                </button>
              </div>
              <p className="text-xs text-soft">ไม่เลือกสถานะ = แสดงทั้งหมด</p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => {
                  const checked = selectedStatuses.includes(status);
                  return (
                    <FilterChip
                      key={status}
                      active={checked}
                      onClick={() =>
                        setSelectedStatuses((current) =>
                          current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
                        )
                      }
                    >
                      {status} ({statusCounts[status] || 0})
                    </FilterChip>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">กลุ่มรถยนต์</p>
                <button type="button" onClick={() => setSelectedVehicleGroups([])} className="text-xs font-semibold text-brand">
                  ทั้งหมด
                </button>
              </div>
              <p className="text-xs text-soft">รายการนี้เปลี่ยนตามสถานะที่เลือกด้านบน</p>
              {vehicleGroupOptions.length ? (
                <div className="flex flex-wrap gap-2">
                  {vehicleGroupOptions.map((group) => {
                    const checked = selectedVehicleGroups.includes(group.name);
                    return (
                      <FilterChip
                        key={group.name}
                        active={checked}
                        onClick={() =>
                          setSelectedVehicleGroups((current) =>
                            current.includes(group.name) ? current.filter((item) => item !== group.name) : [...current, group.name]
                          )
                        }
                      >
                        {group.name} ({group.count})
                      </FilterChip>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
                  ยังไม่พบคอลัมน์กลุ่มรถยนต์ในสต็อกที่ Import
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setExportMode("customer")}
                className={`min-h-11 rounded-lg border px-4 font-bold ${
                  exportMode === "customer" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                สำหรับลูกค้า
              </button>
              <button
                type="button"
                onClick={() => setExportMode("internal")}
                className={`min-h-11 rounded-lg border px-4 font-bold ${
                  exportMode === "internal" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                สำหรับภายใน
              </button>
            </div>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
              Export เป็นตารางแยกตามกลุ่มรถยนต์ หน้า/รูปละ {maxTableItems} คัน ถ้ากลุ่มไหนเกินจะสร้างหลายหน้าพร้อมเลขหน้าอัตโนมัติ
            </p>
          </SectionCard>

        <SectionCard title="Preview รูป" icon={<FileImage size={18} />}>
          <StockPreview vehicles={exportVehicles} mode={exportMode} pageCount={exportPageCount} groupCount={exportGroups.length} />
          <ExportPlanSummary groups={exportGroups} pageCount={exportPageCount} vehicleCount={exportVehicles.length} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => exportImage("png")}
              disabled={exporting || !exportVehicles.length}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-60"
            >
              {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              เซฟ PNG {exportPageCount ? `(${exportPageCount.toLocaleString("th-TH")} รูป)` : ""}
            </button>
            <button
              type="button"
              onClick={() => exportImage("jpeg")}
              disabled={exporting || !exportVehicles.length}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand/60 bg-brand/10 px-4 font-bold text-brand disabled:opacity-60"
            >
              JPG
            </button>
            <button
              type="button"
              onClick={() => exportImage("pdf")}
              disabled={exporting || !exportVehicles.length}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 font-bold text-white disabled:opacity-60"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={copyImage}
              disabled={exporting || !exportVehicles.length}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 font-bold text-white disabled:opacity-60"
            >
              Copy รูปแรก
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </SectionCard>

        <SectionCard title="รายการรถที่ตรงเงื่อนไข" icon={<Search size={18} />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <FilterSummaryPill>พบ {filteredVehicles.length.toLocaleString("th-TH")} คัน</FilterSummaryPill>
              <FilterSummaryPill>เลือกอัตโนมัติ {exportVehicles.length.toLocaleString("th-TH")} คัน</FilterSummaryPill>
            </div>
            <button
              type="button"
              onClick={() => setListOpen((current) => !current)}
              className="min-h-10 rounded-lg border border-line bg-[#0b0d11] px-4 text-sm font-bold text-white transition hover:border-brand"
            >
              {listOpen ? "ซ่อนรายการรถ" : "ดูรายการรถทั้งหมด"}
            </button>
          </div>

          {!listOpen ? (
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
              ระบบจะใช้รถทั้งหมดที่ตรงเงื่อนไขไปสร้างรูปทันที ไม่ต้องติ๊กเลือกทีละคัน
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                    <Loader2 className="mx-auto mb-2 animate-spin text-brand" />
                    กำลังโหลดสต็อก
                  </div>
                ) : visibleVehicles.length ? (
                  visibleVehicles.map((vehicle) => (
                    <div
                      key={`${vehicle.plate}-${vehicle.vin || vehicle.model}`}
                      className="rounded-lg border border-line bg-panel p-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-white">{vehicle.plate || "-"}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-soft">{vehicleTitle(vehicle)}</p>
                        </div>
                        <span className="rounded-full bg-[#0b0d11] px-2 py-1 text-xs font-bold text-soft">
                          อยู่ในชุดรูป
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-soft">
                        <span>สถานะ: <b className="text-white">{vehicle.status || "-"}</b></span>
                        <span>กลุ่ม: <b className="text-white">{vehicle.vehicleGroup || "-"}</b></span>
                        <span>Location: <b className="text-white">{vehicle.parkingLocation || "-"}</b></span>
                        <span>ปีจด: <b className="text-white">{vehicle.year || "-"}</b></span>
                        <span>เกียร์: <b className="text-white">{vehicle.gear || "-"}</b></span>
                        <span>สี: <b className="text-white">{vehicle.color || "-"}</b></span>
                        <span>เลขไมล์: <b className="text-white">{formatMileage(vehicle.mileage)}</b></span>
                        <span className="col-span-2">ราคาเสนอขายRT: <b className="text-brand">{formatPrice(vehicle.salePrice)}</b></span>
                        {exportMode === "internal" && vehicle.pdiNote ? (
                          <span className="col-span-2">PDI: <b className="text-amber-100">{vehicle.pdiNote}</b></span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                    ไม่พบสต็อกตามเงื่อนไข
                  </div>
                )}
              </div>
              {hasMoreVehicles && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 20)}
                  className="min-h-11 w-full rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white transition hover:border-brand"
                >
                  โหลดเพิ่มอีก 20 คัน
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <BottomSheet
        open={advancedOpen}
        title="Advanced Filter"
        onClose={() => setAdvancedOpen(false)}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdvancedFilters(emptyAdvancedFilters)}
              className="min-h-11 rounded-lg border border-line px-4 font-bold text-white transition hover:border-brand"
            >
              ล้างเฉพาะ Filter
            </button>
            <button
              type="button"
              onClick={() => setAdvancedOpen(false)}
              className="min-h-11 rounded-lg bg-brand px-4 font-bold text-ink"
            >
              ใช้ตัวกรอง
            </button>
          </div>
        }
      >
        <AdvancedSelect label="Location" value={advancedFilters.location} onChange={(value) => setAdvancedFilter("location", value)} options={advancedOptions.locations} />
        <AdvancedSelect label="ปีจด" value={advancedFilters.year} onChange={(value) => setAdvancedFilter("year", value)} options={advancedOptions.years} />
        <AdvancedSearchable
          label="รุ่นรถยนต์"
          value={advancedFilters.model}
          onChange={(value) => setAdvancedFilter("model", value)}
          options={advancedOptions.models}
          placeholder="พิมพ์หรือเลือกรุ่นรถ"
          listId="stock-model-options"
        />
        <div className="grid grid-cols-2 gap-2">
          <AdvancedSelect label="เกียร์" value={advancedFilters.gear} onChange={(value) => setAdvancedFilter("gear", value)} options={advancedOptions.gears} />
          <AdvancedSelect label="สี" value={advancedFilters.color} onChange={(value) => setAdvancedFilter("color", value)} options={advancedOptions.colors} />
        </div>
        <AdvancedTextField
          label="ทะเบียน"
          value={advancedFilters.plate}
          onChange={(value) => setAdvancedFilter("plate", value)}
          placeholder="ค้นทะเบียนเฉพาะ"
        />
        <div className="grid grid-cols-2 gap-2">
          <AdvancedTextField
            label="เลขไมล์ต่ำสุด"
            value={advancedFilters.mileageMin}
            onChange={(value) => setAdvancedFilter("mileageMin", value)}
            placeholder="เช่น 50000"
            inputMode="numeric"
          />
          <AdvancedTextField
            label="เลขไมล์สูงสุด"
            value={advancedFilters.mileageMax}
            onChange={(value) => setAdvancedFilter("mileageMax", value)}
            placeholder="เช่น 150000"
            inputMode="numeric"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AdvancedTextField
            label="ราคาต่ำสุด"
            value={advancedFilters.priceMin}
            onChange={(value) => setAdvancedFilter("priceMin", value)}
            placeholder="เช่น 300000"
            inputMode="numeric"
          />
          <AdvancedTextField
            label="ราคาสูงสุด"
            value={advancedFilters.priceMax}
            onChange={(value) => setAdvancedFilter("priceMax", value)}
            placeholder="เช่น 800000"
            inputMode="numeric"
          />
        </div>
      </BottomSheet>
    </PageContainer>
  );
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) throw new Error("ไม่สามารถสร้างไฟล์รูปได้");
  return blob;
}

function buildPdfFromJpegs(images: PdfImage[]) {
  if (!images.length) throw new Error("ยังไม่มีหน้าสำหรับสร้าง PDF");

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const objectCount = 2 + images.length * 3;
  const pageIds = images.map((_, index) => 3 + index * 3);

  const writeObject = (id: number, body: (write: typeof push) => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body(push);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%stock-export\n");
  writeObject(1, (write) => write("<< /Type /Catalog /Pages 2 0 R >>"));
  writeObject(2, (write) => write(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${images.length} >>`));

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const pageWidth = 842;
    const pageHeight = Math.round((pageWidth * image.height) / image.width);
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im${index + 1} Do\nQ`;

    writeObject(pageId, (write) => {
      write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    writeObject(contentId, (write) => {
      write(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    });
    writeObject(imageId, (write) => {
      write(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
      write(image.bytes);
      write("\nendstream");
    });
  });

  const xrefOffset = length;
  push(`xref\n0 ${objectCount + 1}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const blobParts = chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer;
  });
  return new Blob(blobParts, { type: "application/pdf" });
}

function AdvancedSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-white">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none focus:border-brand"
      >
        <option value="">ทั้งหมด</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdvancedSearchable({
  label,
  value,
  options,
  placeholder,
  listId,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  listId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-white">{label}</span>
      <input
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function AdvancedTextField({
  label,
  value,
  placeholder,
  inputMode,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-white">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function ExportPlanSummary({ groups, pageCount, vehicleCount }: { groups: StockExportGroup[]; pageCount: number; vehicleCount: number }) {
  const visibleGroups = groups.slice(0, 6);
  const hiddenCount = Math.max(groups.length - visibleGroups.length, 0);

  if (!vehicleCount) {
    return (
      <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-4 text-center text-sm text-soft">
        เลือกสถานะหรือกลุ่มรถยนต์เพื่อดูจำนวนไฟล์ก่อน Export
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">สรุปไฟล์ที่จะได้</p>
          <p className="mt-1 text-xs text-soft">
            {vehicleCount.toLocaleString("th-TH")} คัน / {groups.length.toLocaleString("th-TH")} กลุ่ม / {pageCount.toLocaleString("th-TH")} หน้า
          </p>
        </div>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
          {maxTableItems} คันต่อหน้า
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleGroups.map((group) => (
          <div key={group.name} className="rounded-lg border border-line bg-panel/70 px-3 py-2">
            <p className="truncate text-sm font-bold text-white">{group.name}</p>
            <p className="mt-1 text-xs text-soft">
              {group.vehicles.length.toLocaleString("th-TH")} คัน - {group.pages.length.toLocaleString("th-TH")} หน้า
            </p>
          </div>
        ))}
      </div>
      {hiddenCount ? (
        <p className="mt-2 text-xs text-soft">
          และอีก {hiddenCount.toLocaleString("th-TH")} กลุ่ม จะถูกสร้างไฟล์ตามลำดับอัตโนมัติ
        </p>
      ) : null}
    </div>
  );
}

function StockPreview({ vehicles, mode, pageCount, groupCount }: { vehicles: StockVehicle[]; mode: ExportMode; pageCount: number; groupCount: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#f6f8f7] text-[#111827] shadow-glow">
      <div className="border-b border-[#d9e1df] bg-[#f9fbfa] p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#15803d]">Stock Catalog Preview</p>
        <h2 className="mt-1 text-xl font-black text-[#111827]">ตารางสต็อกพร้อมส่ง</h2>
        <p className="mt-1 text-xs text-[#64748b]">
          {vehicles.length.toLocaleString("th-TH")} คัน / {groupCount.toLocaleString("th-TH")} กลุ่ม / {Math.max(pageCount, vehicles.length ? 1 : 0).toLocaleString("th-TH")} รูป /{" "}
          {mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#17211d] text-white">
              {["Location", "ทะเบียน", "ปีจด", "รุ่นรถยนต์", "เกียร์", "สี", "เลขไมล์", "ราคาเสนอขายRT"].map((header) => (
                <th key={header} className="border border-[#2d3a35] px-2 py-2 text-left font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.slice(0, 8).map((vehicle) => (
              <tr key={vehicle.plate} className="bg-white">
                <td className="border border-[#dce3e1] px-2 py-1">{shortLocation(vehicle.parkingLocation)}</td>
                <td className="border border-[#dce3e1] px-2 py-1 text-center font-bold">{vehicle.plate || "-"}</td>
                <td className="border border-[#dce3e1] px-2 py-1 text-center">{vehicle.year || "-"}</td>
                <td className="border border-[#dce3e1] px-2 py-1">{vehicleTitle(vehicle)}</td>
                <td className="border border-[#dce3e1] px-2 py-1 text-center">{vehicle.gear || "-"}</td>
                <td className="border border-[#dce3e1] px-2 py-1 text-center">{vehicle.color || "-"}</td>
                <td className="border border-[#dce3e1] px-2 py-1 text-right">{formatMileage(vehicle.mileage).replace(" กม.", "")}</td>
                <td className="border border-[#dce3e1] bg-[#e6fbf3] px-2 py-1 text-right text-sm font-black">{formatPrice(vehicle.salePrice).replace(" บาท", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vehicles.length ? <p className="p-2 text-xs text-[#475569]">Preview แสดง 8 คันแรก ตอน Export จะแยกตามกลุ่มรถยนต์และแบ่งรูปละ 30 คัน</p> : <p className="p-6 text-center text-sm text-[#475569]">เลือกสต็อกเพื่อดู Preview</p>}
    </div>
  );
}

function renderStockTableCanvas(
  canvas: HTMLCanvasElement,
  vehicles: StockVehicle[],
  mode: ExportMode,
  page: number,
  totalPages: number,
  groupName: string,
  groupTotal: number,
  exportTotal: number
) {
  const width = 1600;
  const margin = 40;
  const headerHeight = 118;
  const tableTop = 150;
  const rowHeight = vehicles.length <= 3 ? 68 : vehicles.length <= 8 ? 60 : 54;
  const footerHeight = 54;
  const rows = vehicles.slice(0, maxTableItems);
  const headerRowHeight = 50;
  const height = tableTop + headerRowHeight + rows.length * rowHeight + footerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.scale(ratio, ratio);

  ctx.fillStyle = "#f6f8f7";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(margin, 26, width - margin * 2, headerHeight);
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(margin, 26, 8, headerHeight);
  ctx.strokeStyle = "#d9e1df";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(margin, 26, width - margin * 2, headerHeight);

  ctx.fillStyle = "#111827";
  ctx.font = "900 42px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(groupName || "Stock", margin + 28, 76);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText(
    `${groupTotal.toLocaleString("th-TH")} คัน | อัปเดต ${new Date().toLocaleDateString("th-TH")} | ${mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"}`,
    margin + 28,
    112
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#111827";
  ctx.font = "800 26px Arial, sans-serif";
  ctx.fillText(`หน้า ${page}/${totalPages}`, width - margin - 26, 76);

  const columns = [
    { key: "location", label: "Location", width: 150 },
    { key: "plate", label: "ทะเบียน", width: 140 },
    { key: "year", label: "ปีจด", width: 110 },
    { key: "model", label: "รุ่นรถยนต์", width: 520 },
    { key: "gear", label: "เกียร์", width: 90 },
    { key: "color", label: "สี", width: 170 },
    { key: "mileage", label: "เลขไมล์", width: 150 },
    { key: "price", label: "ราคาเสนอขายRT", width: 190 }
  ];

  let x = margin;
  ctx.font = "800 21px Arial, sans-serif";
  columns.forEach((column) => {
    ctx.fillStyle = "#17211d";
    ctx.fillRect(x, tableTop, column.width, headerRowHeight);
    ctx.strokeStyle = "#2d3a35";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, tableTop, column.width, headerRowHeight);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = column.key === "price" ? "right" : "center";
    ctx.fillText(column.label, column.key === "price" ? x + column.width - 16 : x + column.width / 2, tableTop + 32);
    x += column.width;
  });

  rows.forEach((vehicle, rowIndex) => {
    const rowY = tableTop + headerRowHeight + rowIndex * rowHeight;
    const values: Record<string, string> = {
      location: shortLocation(vehicle.parkingLocation),
      plate: vehicle.plate || "-",
      year: vehicle.year || "-",
      model: vehicleTitle(vehicle),
      gear: vehicle.gear || "-",
      color: vehicle.color || "-",
      mileage: formatMileage(vehicle.mileage).replace(" กม.", ""),
      price: formatPrice(vehicle.salePrice).replace(" บาท", "")
    };

    x = margin;
    columns.forEach((column) => {
      ctx.fillStyle = column.key === "price" ? "#e6fbf3" : rowIndex % 2 ? "#fbfcfc" : "#ffffff";
      ctx.fillRect(x, rowY, column.width, rowHeight);
      ctx.strokeStyle = "#dce3e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, rowY, column.width, rowHeight);
      ctx.fillStyle = "#111827";
      ctx.font = column.key === "price" ? "900 22px Arial, sans-serif" : "600 19px Arial, sans-serif";
      ctx.textAlign = column.key === "price" || column.key === "mileage" ? "right" : column.key === "model" || column.key === "location" ? "left" : "center";
      const textX =
        column.key === "price" || column.key === "mileage" ? x + column.width - 12 : column.key === "model" || column.key === "location" ? x + 12 : x + column.width / 2;
      if (column.key === "model") {
        drawWrappedCellText(ctx, values[column.key], textX, rowY + 21, column.width - 24, 23, 2);
      } else if (column.key === "location" || column.key === "color") {
        drawBadgeCellText(ctx, values[column.key], textX, rowY + Math.floor(rowHeight / 2), column.width - 24);
      } else {
        drawClippedText(ctx, values[column.key], textX, rowY + Math.floor(rowHeight / 2) + 7, column.width - 20);
      }
      x += column.width;
    });
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 18px Arial, sans-serif";
  ctx.fillText("Generated from latest stock", margin, height - 22);
  ctx.textAlign = "right";
  ctx.fillText(`จำนวนรถทั้งหมด ${exportTotal.toLocaleString("th-TH")} คัน`, width - margin, height - 22);
  ctx.textAlign = "left";
}

function chunkVehicles(vehicles: StockVehicle[], size: number) {
  const chunks: StockVehicle[][] = [];
  for (let index = 0; index < vehicles.length; index += size) {
    chunks.push(vehicles.slice(index, index + size));
  }
  return chunks;
}

function groupVehiclesForExport(vehicles: StockVehicle[]): StockExportGroup[] {
  const groups = new Map<string, StockVehicle[]>();

  vehicles.forEach((vehicle) => {
    const groupName = stockVehicleGroup(vehicle) || "ไม่ระบุ";
    const list = groups.get(groupName) || [];
    list.push(vehicle);
    groups.set(groupName, list);
  });

  return Array.from(groups.entries())
    .map(([name, groupVehicles]) => ({
      name,
      vehicles: groupVehicles,
      pages: chunkVehicles(groupVehicles, maxTableItems)
    }))
    .sort((a, b) => b.vehicles.length - a.vehicles.length || a.name.localeCompare(b.name, "th"));
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawClippedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.save();
  const align = ctx.textAlign;
  const clipX = align === "right" ? x - maxWidth : align === "center" ? x - maxWidth / 2 : x;
  ctx.beginPath();
  ctx.rect(clipX, y - 25, maxWidth, 34);
  ctx.clip();
  ctx.fillText(text || "-", x, y);
  ctx.restore();
}

function drawBadgeCellText(ctx: CanvasRenderingContext2D, text: string, x: number, centerY: number, maxWidth: number) {
  const value = text || "-";
  const measured = Math.min(ctx.measureText(value).width + 20, maxWidth);
  ctx.save();
  const align = ctx.textAlign;
  const left = align === "center" ? x - measured / 2 : align === "right" ? x - measured : x;
  drawRoundedRect(ctx, left, centerY - 15, measured, 30, 15);
  ctx.fillStyle = "#eef7f2";
  ctx.fill();
  ctx.strokeStyle = "#cfe3d7";
  ctx.stroke();
  ctx.fillStyle = "#14532d";
  ctx.textAlign = "center";
  drawClippedText(ctx, value, left + measured / 2, centerY + 7, measured - 14);
  ctx.restore();
}

function drawWrappedCellText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const value = text || "-";
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) {
    let last = visibleLines[visibleLines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    visibleLines[visibleLines.length - 1] = `${last}…`;
  }

  visibleLines.forEach((line, index) => {
    drawClippedText(ctx, line, x, y + index * lineHeight, maxWidth);
  });
}
