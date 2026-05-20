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

const maxExportItems = 12;
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

function fileName(extension: "png" | "jpg") {
  const date = new Date().toISOString().slice(0, 10);
  return `big-car-stock-${date}.${extension}`;
}

export default function StockExportPage() {
  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [selectedPlates, setSelectedPlates] = useState<string[]>([]);
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

  const groupMatchedVehicles = useMemo(() => {
    return plateMatchedVehicles.filter((vehicle) => {
      const group = stockVehicleGroup(vehicle) || "ไม่ระบุ";
      return !selectedVehicleGroups.length || selectedVehicleGroups.includes(group);
    });
  }, [plateMatchedVehicles, selectedVehicleGroups]);

  const filteredVehicles = useMemo(() => {
    return groupMatchedVehicles.filter((vehicle) => {
      const status = stockStatus(vehicle);
      return !selectedStatuses.length || !importedStatusCount || selectedStatuses.includes(status);
    });
  }, [groupMatchedVehicles, importedStatusCount, selectedStatuses]);

  const statusCounts = useMemo(() => {
    return groupMatchedVehicles.reduce<Record<string, number>>((counts, vehicle) => {
      const status = stockStatus(vehicle) || "ไม่ระบุ";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }, [groupMatchedVehicles]);

  const vehicleGroupOptions = useMemo(() => {
    const counts = plateMatchedVehicles.reduce<Record<string, number>>((nextCounts, vehicle) => {
      const group = stockVehicleGroup(vehicle);
      if (group) nextCounts[group] = (nextCounts[group] || 0) + 1;
      return nextCounts;
    }, {});

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [plateMatchedVehicles]);

  const selectedVehicles = useMemo(() => {
    const selected = new Set(selectedPlates);
    return vehicles.filter((vehicle) => selected.has(vehicle.plate)).slice(0, maxExportItems);
  }, [selectedPlates, vehicles]);

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
      setSelectedPlates(data.vehicles.slice(0, 6).map((vehicle) => vehicle.plate));
      if (data.warning) setError(`${data.warning} - ถ้าเพิ่งเพิ่มฟีเจอร์นี้ ต้อง deploy Apps Script เวอร์ชันใหม่ก่อน`);
      else setMessage(`โหลดสต็อก ${data.total.toLocaleString("th-TH")} คันแล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสต็อกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function togglePlate(plate: string) {
    setSelectedPlates((current) => {
      if (current.includes(plate)) return current.filter((item) => item !== plate);
      if (current.length >= maxExportItems) {
        setError(`เลือกได้สูงสุด ${maxExportItems} คันต่อรูป เพื่อให้อ่านง่ายบนมือถือ`);
        return current;
      }
      setError("");
      return [...current, plate];
    });
  }

  function selectVisible() {
    setSelectedPlates(filteredVehicles.slice(0, maxExportItems).map((vehicle) => vehicle.plate));
  }

  function clearSelected() {
    setSelectedPlates([]);
  }

  async function exportImage(type: "png" | "jpg") {
    setExporting(true);
    setError("");
    setMessage("");

    try {
      if (!selectedVehicles.length) throw new Error("กรุณาเลือกสต็อกก่อน Export");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");
      await renderStockCanvas(canvas, selectedVehicles, exportMode);

      const mimeType = type === "png" ? "image/png" : "image/jpeg";
      const quality = type === "png" ? undefined : 0.92;
      const url = canvas.toDataURL(mimeType, quality);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(type);
      link.click();
      setMessage(`Export ${type.toUpperCase()} แล้ว`);
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
      if (!selectedVehicles.length) throw new Error("กรุณาเลือกสต็อกก่อน Copy");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");
      await renderStockCanvas(canvas, selectedVehicles, exportMode);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("เครื่องนี้ยังไม่รองรับ Copy Image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage("Copy รูปสต็อกแล้ว");
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
          <SectionCard title="ค้นหาและเลือกสต็อก" icon={<Search size={18} />}>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นทะเบียน / รุ่น / ปี / Location"
                className="h-12 rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
              />
              <button type="button" onClick={selectVisible} className="min-h-12 rounded-lg bg-brand px-4 font-bold text-ink">
                เลือกชุดนี้
              </button>
              <button type="button" onClick={clearSelected} className="min-h-12 rounded-lg border border-line px-4 font-semibold text-white">
                ล้าง
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-soft">
              <span className="rounded-full border border-line px-3 py-1">เลือกแล้ว {selectedVehicles.length}/{maxExportItems}</span>
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
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                <Loader2 className="mx-auto mb-2 animate-spin text-brand" />
                กำลังโหลดสต็อก
              </div>
            ) : filteredVehicles.length ? (
              filteredVehicles.slice(0, 120).map((vehicle) => {
                const selected = selectedPlates.includes(vehicle.plate);
                return (
                  <button
                    key={`${vehicle.plate}-${vehicle.vin || vehicle.model}`}
                    type="button"
                    onClick={() => togglePlate(vehicle.plate)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selected ? "border-brand bg-[#122019]" : "border-line bg-panel hover:border-brand/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-white">{vehicle.plate || "-"}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-soft">{vehicleTitle(vehicle)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${selected ? "bg-brand text-ink" : "bg-[#0b0d11] text-soft"}`}>
                        {selected ? "เลือก" : "แตะ"}
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
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                ไม่พบสต็อกตามเงื่อนไข
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Preview รูป" icon={<FileImage size={18} />}>
            <StockPreview vehicles={selectedVehicles} mode={exportMode} />
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => exportImage("png")}
                disabled={exporting || !selectedVehicles.length}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-60"
              >
                {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                PNG
              </button>
              <button
                type="button"
                onClick={() => exportImage("jpg")}
                disabled={exporting || !selectedVehicles.length}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand/50 px-4 font-bold text-brand disabled:opacity-60"
              >
                JPG
              </button>
              <button
                type="button"
                onClick={copyImage}
                disabled={exporting || !selectedVehicles.length}
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

function StockPreview({ vehicles, mode }: { vehicles: StockVehicle[]; mode: ExportMode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#080a0d]">
      <div className="bg-gradient-to-r from-[#101820] via-[#0e1713] to-[#101820] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand">BIG CAR RDD</p>
        <h2 className="mt-1 text-2xl font-black text-white">รถพร้อมขาย</h2>
        <p className="mt-1 text-sm text-soft">คัดแล้ว {vehicles.length} คัน / {mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"}</p>
      </div>
      <div className="space-y-2 p-3">
        {vehicles.length ? vehicles.map((vehicle) => (
          <div key={vehicle.plate} className="rounded-lg border border-line bg-panel p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-black text-white">{vehicle.plate}</p>
                <p className="mt-1 text-sm text-soft">{vehicleTitle(vehicle)}</p>
              </div>
              <p className="text-right text-sm font-black text-brand">{formatPrice(vehicle.salePrice)}</p>
            </div>
            <p className="mt-2 text-xs text-soft">
              {vehicle.parkingLocation || "-"} / ปี {vehicle.year || "-"} / {vehicle.gear || "-"} / สี {vehicle.color || "-"} / {formatMileage(vehicle.mileage)}
            </p>
            {mode === "internal" && vehicle.pdiNote ? <p className="mt-1 text-xs text-amber-100">PDI: {vehicle.pdiNote}</p> : null}
          </div>
        )) : (
          <p className="py-12 text-center text-sm text-soft">เลือกสต็อกเพื่อดู Preview</p>
        )}
      </div>
    </div>
  );
}

async function renderStockCanvas(canvas: HTMLCanvasElement, vehicles: StockVehicle[], mode: ExportMode) {
  const width = 1080;
  const cardHeight = mode === "internal" ? 176 : 154;
  const height = Math.max(1080, 270 + vehicles.length * cardHeight + 110);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.scale(ratio, ratio);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#07090d");
  bg.addColorStop(0.48, "#0d1712");
  bg.addColorStop(1, "#10131a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#22c55e";
  ctx.font = "800 34px Arial, sans-serif";
  ctx.fillText("BIG CAR RDD", 64, 78);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px Arial, sans-serif";
  ctx.fillText("รถพร้อมขาย", 64, 154);
  ctx.fillStyle = "#aab3c0";
  ctx.font = "400 30px Arial, sans-serif";
  ctx.fillText(`คัดสต็อก ${vehicles.length} คัน / ${mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"} / อัปเดต ${new Date().toLocaleDateString("th-TH")}`, 64, 206);

  let y = 260;
  vehicles.forEach((vehicle, index) => {
    const boxHeight = mode === "internal" && vehicle.pdiNote ? 146 : 124;
    roundRect(ctx, 54, y, width - 108, boxHeight, 18, index % 2 ? "#111821" : "#0d1219", "#263141");
    ctx.fillStyle = "#22c55e";
    ctx.font = "900 34px Arial, sans-serif";
    ctx.fillText(vehicle.plate || "-", 82, y + 43);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 30px Arial, sans-serif";
    fillTextEllipsis(ctx, vehicleTitle(vehicle), 82, y + 80, 560);
    ctx.fillStyle = "#c7d0dc";
    ctx.font = "500 22px Arial, sans-serif";
    fillTextEllipsis(
      ctx,
      `${vehicle.parkingLocation || "-"} | ปี ${vehicle.year || "-"} | ${vehicle.gear || "-"} | สี ${vehicle.color || "-"} | ${formatMileage(vehicle.mileage)}`,
      82,
      y + 112,
      700
    );

    ctx.textAlign = "right";
    ctx.fillStyle = "#22c55e";
    ctx.font = "900 34px Arial, sans-serif";
    ctx.fillText(formatPrice(vehicle.salePrice), width - 82, y + 43);
    ctx.fillStyle = "#c7d0dc";
    ctx.font = "500 24px Arial, sans-serif";
    ctx.fillText(vehicle.status || "-", width - 82, y + 82);
    ctx.textAlign = "left";

    if (mode === "internal" && vehicle.pdiNote) {
      ctx.fillStyle = "#fde68a";
      ctx.font = "500 22px Arial, sans-serif";
      fillTextEllipsis(ctx, `PDI: ${vehicle.pdiNote}`, 82, y + 140, 880);
    }

    y += cardHeight;
  });

  ctx.fillStyle = "#7d8794";
  ctx.font = "500 24px Arial, sans-serif";
  ctx.fillText("BIG CAR CRM", 64, height - 52);
  ctx.textAlign = "right";
  ctx.fillText("สอบถามรายละเอียดเพิ่มเติม", width - 64, height - 52);
  ctx.textAlign = "left";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke: string) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
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
