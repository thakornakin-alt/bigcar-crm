"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileImage, Loader2, Search, Upload } from "lucide-react";
import { PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { StockVehicle } from "@/lib/types";

type StockListResponse = {
  vehicles: StockVehicle[];
  total: number;
  warning?: string;
};

const maxTableItems = 30;
const stockStatuses = ["รอขาย", "เตรียมส่งลาน", "จอง_Sale", "จอง_Internal", "จอง_รถทดแทน", "ขายแล้ว"];

type ExportMode = "customer" | "internal";

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

function vehicleTitle(vehicle: StockVehicle) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "-";
}

function stockStatus(vehicle: StockVehicle) {
  return String(vehicle.status || "").trim();
}

function stockVehicleGroup(vehicle: StockVehicle) {
  return String(vehicle.vehicleGroup || "").trim();
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function fileName(extension: "png" | "jpg", page?: number, totalPages?: number) {
  const date = new Date().toISOString().slice(0, 10);
  if (page && totalPages && totalPages > 1) return `big-car-stock-${date}-page-${page}-of-${totalPages}.${extension}`;
  return `big-car-stock-${date}.${extension}`;
}

export default function StockExportPage() {
  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedVehicleGroups, setSelectedVehicleGroups] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>("customer");
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
    return groupMatchedVehicles;
  }, [groupMatchedVehicles]);

  const statusCounts = useMemo(() => {
    return groupMatchedVehicles.reduce<Record<string, number>>((counts, vehicle) => {
      const status = stockStatus(vehicle) || "ไม่ระบุ";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }, [groupMatchedVehicles]);

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
  const exportPages = useMemo(() => chunkVehicles(exportVehicles, maxTableItems), [exportVehicles]);

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    const availableGroups = new Set(vehicleGroupOptions.map((group) => group.name));
    setSelectedVehicleGroups((current) => current.filter((group) => availableGroups.has(group)));
  }, [vehicleGroupOptions]);

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
  }

  async function exportImage(type: "png" | "jpg") {
    setExporting(true);
    setError("");
    setMessage("");

    try {
      if (!exportVehicles.length) throw new Error("ยังไม่มีรถตามตัวกรองสำหรับ Export");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");
      const mimeType = type === "png" ? "image/png" : "image/jpeg";
      const quality = type === "png" ? undefined : 0.92;
      const pages = exportPages.length ? exportPages : [exportVehicles];
      const files: File[] = [];

      for (let index = 0; index < pages.length; index += 1) {
        renderStockTableCanvas(canvas, pages[index], exportMode, index + 1, pages.length);
        const blob = await canvasToBlob(canvas, mimeType, quality);
        files.push(new File([blob], fileName(type, index + 1, pages.length), { type: mimeType }));
      }

      const shareData = {
        title: "ตารางสต็อก BIG CAR",
        text: `ตารางสต็อก ${exportVehicles.length.toLocaleString("th-TH")} คัน`,
        files
      };

      if (type === "png" && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setMessage(`เปิดเมนูเซฟ/แชร์รูปแล้ว ${files.length} รูป`);
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

      setMessage(`Export ${type.toUpperCase()} แล้ว ${pages.length} รูป`);
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
      renderStockTableCanvas(canvas, exportPages[0] || exportVehicles, exportMode, 1, Math.max(exportPages.length, 1));
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("เครื่องนี้ยังไม่รองรับ Copy Image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage(exportPages.length > 1 ? "Copy รูปหน้าแรกแล้ว ถ้ามีหลายหน้าให้ใช้ PNG/JPG" : "Copy รูปสต็อกแล้ว");
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <SectionCard title="ค้นหาและกรองสต็อก" icon={<Search size={18} />}>
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
              <span className="rounded-full border border-line px-3 py-1">ออกเป็น {Math.max(exportPages.length, exportVehicles.length ? 1 : 0)} รูป</span>
              <span className="rounded-full border border-line px-3 py-1">แสดง {filteredVehicles.length.toLocaleString("th-TH")} คัน</span>
              <span className="rounded-full border border-line px-3 py-1">มีสถานะ {importedStatusCount.toLocaleString("th-TH")} คัน</span>
              <span className="rounded-full border border-line px-3 py-1">มีกลุ่มรถยนต์ {importedVehicleGroupCount.toLocaleString("th-TH")} คัน</span>
            </div>
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
                {stockStatuses.map((status) => {
                  const checked = selectedStatuses.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setSelectedStatuses((current) =>
                          current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
                        )
                      }
                      className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${
                        checked ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-soft"
                      }`}
                    >
                      {status} ({statusCounts[status] || 0})
                    </button>
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
                      <button
                        key={group.name}
                        type="button"
                        onClick={() =>
                          setSelectedVehicleGroups((current) =>
                            current.includes(group.name) ? current.filter((item) => item !== group.name) : [...current, group.name]
                          )
                        }
                        className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${
                          checked ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-soft"
                        }`}
                      >
                        {group.name} ({group.count})
                      </button>
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
              Export เป็นตารางอัตโนมัติ รูปละ {maxTableItems} คัน ถ้าเกินจะดาวน์โหลดหลายรูปพร้อมเลขหน้า
            </p>
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                <Loader2 className="mx-auto mb-2 animate-spin text-brand" />
                กำลังโหลดสต็อก
              </div>
            ) : filteredVehicles.length ? (
              filteredVehicles.slice(0, 120).map((vehicle) => (
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
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Preview รูป" icon={<FileImage size={18} />}>
            <StockPreview vehicles={exportVehicles} mode={exportMode} pageCount={exportPages.length} />
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => exportImage("png")}
                disabled={exporting || !exportVehicles.length}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-60"
              >
                {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                PNG
              </button>
              <button
                type="button"
                onClick={() => exportImage("jpg")}
                disabled={exporting || !exportVehicles.length}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand/50 px-4 font-bold text-brand disabled:opacity-60"
              >
                JPG
              </button>
              <button
                type="button"
                onClick={copyImage}
                disabled={exporting || !exportVehicles.length}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 font-bold text-white disabled:opacity-60"
              >
                Copy
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </SectionCard>
        </aside>
      </div>
    </PageContainer>
  );
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) throw new Error("ไม่สามารถสร้างไฟล์รูปได้");
  return blob;
}

function StockPreview({ vehicles, mode, pageCount }: { vehicles: StockVehicle[]; mode: ExportMode; pageCount: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#f7faf7] text-[#111827]">
      <div className="bg-[#00a651] p-3 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em]">BIG CAR RDD</p>
        <h2 className="mt-1 text-xl font-black">ตารางรถพร้อมขาย</h2>
        <p className="mt-1 text-xs text-white/80">
          คัดแล้ว {vehicles.length.toLocaleString("th-TH")} คัน / {Math.max(pageCount, vehicles.length ? 1 : 0).toLocaleString("th-TH")} รูป /{" "}
          {mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#00a651] text-white">
              {["Location", "ทะเบียน", "ปีจด", "รุ่นรถยนต์", "เกียร์", "สี", "เลขไมล์", "ราคาเสนอขายRT"].map((header) => (
                <th key={header} className="border border-[#0f5132] px-2 py-2 text-left font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.slice(0, 8).map((vehicle) => (
              <tr key={vehicle.plate} className="bg-white">
                <td className="border border-[#111827] px-2 py-1">{vehicle.parkingLocation || "-"}</td>
                <td className="border border-[#111827] px-2 py-1 font-bold">{vehicle.plate || "-"}</td>
                <td className="border border-[#111827] px-2 py-1">{vehicle.year || "-"}</td>
                <td className="border border-[#111827] px-2 py-1">{vehicleTitle(vehicle)}</td>
                <td className="border border-[#111827] px-2 py-1">{vehicle.gear || "-"}</td>
                <td className="border border-[#111827] px-2 py-1">{vehicle.color || "-"}</td>
                <td className="border border-[#111827] px-2 py-1 text-right">{formatMileage(vehicle.mileage).replace(" กม.", "")}</td>
                <td className="border border-[#111827] bg-[#dff7f8] px-2 py-1 text-right font-bold">{formatPrice(vehicle.salePrice).replace(" บาท", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vehicles.length ? <p className="p-2 text-xs text-[#475569]">Preview แสดง 8 คันแรก ตอน Export จะแบ่งรูปละ 30 คันพร้อมเลขหน้า</p> : <p className="p-6 text-center text-sm text-[#475569]">เลือกสต็อกเพื่อดู Preview</p>}
    </div>
  );
}

function renderStockTableCanvas(canvas: HTMLCanvasElement, vehicles: StockVehicle[], mode: ExportMode, page: number, totalPages: number) {
  const width = 1600;
  const margin = 36;
  const headerHeight = 96;
  const tableTop = 140;
  const rowHeight = 46;
  const footerHeight = 58;
  const rows = vehicles.slice(0, maxTableItems);
  const height = tableTop + 54 + rows.length * rowHeight + footerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.scale(ratio, ratio);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#00a651";
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px Arial, sans-serif";
  ctx.fillText("BIG CAR RDD", margin, 42);
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText(
    `ตารางรถพร้อมขาย ${rows.length} คัน / หน้า ${page}/${totalPages} / ${mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"} / ${new Date().toLocaleDateString("th-TH")}`,
    margin,
    78
  );

  const columns = [
    { key: "location", label: "Location", width: 170 },
    { key: "plate", label: "ทะเบียน", width: 150 },
    { key: "year", label: "ปีจด", width: 120 },
    { key: "model", label: "รุ่นรถยนต์", width: 530 },
    { key: "gear", label: "เกียร์", width: 95 },
    { key: "color", label: "สี", width: 180 },
    { key: "mileage", label: "เลขไมล์", width: 145 },
    { key: "price", label: "ราคาเสนอขายRT", width: 138 }
  ];

  let x = margin;
  ctx.font = "800 22px Arial, sans-serif";
  columns.forEach((column, index) => {
    ctx.fillStyle = index === columns.length - 1 ? "#08706d" : "#00a651";
    ctx.fillRect(x, tableTop, column.width, 54);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, tableTop, column.width, 54);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = column.key === "price" ? "right" : "center";
    ctx.fillText(column.label, column.key === "price" ? x + column.width - 14 : x + column.width / 2, tableTop + 35);
    x += column.width;
  });

  rows.forEach((vehicle, rowIndex) => {
    const rowY = tableTop + 54 + rowIndex * rowHeight;
    const values: Record<string, string> = {
      location: vehicle.parkingLocation || "-",
      plate: vehicle.plate || "-",
      year: vehicle.year || "-",
      model: vehicleTitle(vehicle),
      gear: vehicle.gear || "-",
      color: vehicle.color || "-",
      mileage: formatMileage(vehicle.mileage).replace(" กม.", ""),
      price: formatPrice(vehicle.salePrice).replace(" บาท", "")
    };

    x = margin;
    columns.forEach((column, index) => {
      ctx.fillStyle = column.key === "price" ? "#dff7f8" : rowIndex % 2 ? "#f8fafc" : "#ffffff";
      ctx.fillRect(x, rowY, column.width, rowHeight);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, rowY, column.width, rowHeight);
      ctx.fillStyle = "#111827";
      ctx.font = column.key === "price" ? "800 20px Arial, sans-serif" : "500 20px Arial, sans-serif";
      ctx.textAlign = column.key === "price" || column.key === "mileage" ? "right" : column.key === "model" || column.key === "location" ? "left" : "center";
      const textX =
        column.key === "price" || column.key === "mileage" ? x + column.width - 10 : column.key === "model" || column.key === "location" ? x + 10 : x + column.width / 2;
      fillTextEllipsis(ctx, values[column.key], textX, rowY + 30, column.width - 20);
      x += column.width;
      if (index === columns.length - 1) ctx.textAlign = "left";
    });
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText(`BIG CAR CRM | หน้า ${page}/${totalPages}`, margin, height - 22);
  ctx.textAlign = "right";
  ctx.fillText("สร้างจากสต็อกล่าสุด", width - margin, height - 22);
  ctx.textAlign = "left";
}

function chunkVehicles(vehicles: StockVehicle[], size: number) {
  const chunks: StockVehicle[][] = [];
  for (let index = 0; index < vehicles.length; index += size) {
    chunks.push(vehicles.slice(index, index + size));
  }
  return chunks;
}

function fillTextEllipsis(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let value = text;
  while (value.length > 0 && ctx.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  ctx.fillText(`${value}...`, x, y);
}
