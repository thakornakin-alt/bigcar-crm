"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Car, Copy, Gauge, Loader2, MapPin, RefreshCw, Search, Send, Tag } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard } from "@/app/components/ui";
import type { StockVehicle } from "@/lib/types";

type StockListResponse = {
  vehicles: StockVehicle[];
  total: number;
  warning?: string;
};

type PriceFilter = {
  min: string;
  max: string;
};

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function searchable(value: unknown) {
  return normalize(value).toLowerCase().replace(/\s+/g, "");
}

function formatMoney(value: unknown) {
  const raw = normalize(value).replace(/[^\d.]/g, "");
  const number = Number(raw);
  if (!number) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(number)} บาท`;
}

function numericPrice(value: unknown) {
  const number = Number(normalize(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function vehicleName(vehicle: StockVehicle) {
  return [vehicle.brand, vehicle.model].map(normalize).filter(Boolean).join(" ") || "-";
}

function compactPlate(value: string) {
  return value.replace(/\s+/g, "");
}

function uniqueOptions(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));
}

function vehicleText(vehicle: StockVehicle) {
  return [
    vehicle.plate,
    compactPlate(vehicle.plate || ""),
    vehicle.brand,
    vehicle.model,
    vehicle.year,
    vehicle.color,
    vehicle.salePrice,
    vehicle.parkingLocation,
    vehicle.status,
    vehicle.gear,
    vehicle.mileage,
    vehicle.vehicleGroup
  ]
    .map(searchable)
    .join("");
}

function copyMessage(vehicle: StockVehicle) {
  return [
    "ข้อมูลรถ",
    `ทะเบียน: ${vehicle.plate || "-"}`,
    `รุ่น: ${vehicleName(vehicle)}`,
    `ปีจด: ${vehicle.year || "-"}`,
    `สี: ${vehicle.color || "-"}`,
    `เกียร์: ${vehicle.gear || "-"}`,
    `เลขไมล์: ${vehicle.mileage || "-"}`,
    `ราคาเสนอขาย RT: ${formatMoney(vehicle.salePrice)}`,
    `สถานะ: ${vehicle.status || "-"}`,
    `Location: ${vehicle.parkingLocation || "-"}`,
    `กลุ่มรถยนต์: ${vehicle.vehicleGroup || "-"}`
  ].join("\n");
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
  return data;
}

export default function FastVehicleSearchPage() {
  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  const [locationFilter, setLocationFilter] = useState("ทั้งหมด");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>({ min: "", max: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedPlate, setCopiedPlate] = useState("");

  async function loadStock() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await readJson<StockListResponse>("/api/stock/list?limit=1000");
      setVehicles(data.vehicles || []);
      if (data.warning) setMessage(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสต็อกไม่สำเร็จ");
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  const groups = useMemo(() => uniqueOptions(vehicles.map((vehicle) => vehicle.vehicleGroup)), [vehicles]);
  const statuses = useMemo(() => uniqueOptions(vehicles.map((vehicle) => vehicle.status)), [vehicles]);
  const locations = useMemo(() => uniqueOptions(vehicles.map((vehicle) => vehicle.parkingLocation)), [vehicles]);

  const filteredVehicles = useMemo(() => {
    const term = searchable(query);
    const minPrice = Number(priceFilter.min.replace(/[^\d.]/g, ""));
    const maxPrice = Number(priceFilter.max.replace(/[^\d.]/g, ""));

    return vehicles.filter((vehicle) => {
      if (term && !vehicleText(vehicle).includes(term)) return false;
      if (groupFilter !== "ทั้งหมด" && normalize(vehicle.vehicleGroup) !== groupFilter) return false;
      if (statusFilter !== "ทั้งหมด" && normalize(vehicle.status) !== statusFilter) return false;
      if (locationFilter !== "ทั้งหมด" && normalize(vehicle.parkingLocation) !== locationFilter) return false;

      const price = numericPrice(vehicle.salePrice);
      if (minPrice && price < minPrice) return false;
      if (maxPrice && price > maxPrice) return false;

      return true;
    });
  }, [vehicles, query, groupFilter, statusFilter, locationFilter, priceFilter]);

  const visibleVehicles = filteredVehicles.slice(0, 80);

  function clearFilters() {
    setQuery("");
    setGroupFilter("ทั้งหมด");
    setStatusFilter("ทั้งหมด");
    setLocationFilter("ทั้งหมด");
    setPriceFilter({ min: "", max: "" });
    setCopiedPlate("");
  }

  async function copyVehicle(vehicle: StockVehicle) {
    const text = copyMessage(vehicle);
    await navigator.clipboard.writeText(text);
    setCopiedPlate(vehicle.plate || "");
    setMessage(`คัดลอกข้อมูล ${vehicle.plate || vehicleName(vehicle)} แล้ว`);
  }

  async function shareVehicle(vehicle: StockVehicle) {
    const text = copyMessage(vehicle);
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await copyVehicle(vehicle);
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="แย่งคิวรถ"
        subtitle="ค้นหารถเร็วพิเศษ แล้วคัดลอกข้อมูลไปส่งต่อในช่องทางจริง"
        actions={
          <button
            type="button"
            onClick={loadStock}
            disabled={loading}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-bold text-white transition hover:border-brand disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin text-brand" /> : <RefreshCw size={18} className="text-brand" />}
            รีเฟรช
          </button>
        }
      />

      {(message || error) && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
            error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-brand/10 text-brand"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="ค้นหารถ" icon={<Search size={18} />}>
          <SearchField
            icon={<Search size={18} />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ทะเบียน / รุ่น / กลุ่มรถ / สถานะ / ราคา / Location"
            autoFocus
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-soft">ราคาต่ำสุด</span>
              <input
                value={priceFilter.min}
                onChange={(event) => setPriceFilter((current) => ({ ...current, min: event.target.value.replace(/[^\d]/g, "") }))}
                inputMode="numeric"
                placeholder="เช่น 300000"
                className="h-11 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-soft">ราคาสูงสุด</span>
              <input
                value={priceFilter.max}
                onChange={(event) => setPriceFilter((current) => ({ ...current, max: event.target.value.replace(/[^\d]/g, "") }))}
                inputMode="numeric"
                placeholder="เช่น 900000"
                className="h-11 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
              />
            </label>
          </div>

          <FilterBlock title="กลุ่มรถยนต์">
            <FilterChip active={groupFilter === "ทั้งหมด"} onClick={() => setGroupFilter("ทั้งหมด")}>ทั้งหมด</FilterChip>
            {groups.map((group) => (
              <FilterChip key={group} active={groupFilter === group} onClick={() => setGroupFilter(group)}>
                {group}
              </FilterChip>
            ))}
          </FilterBlock>

          <FilterBlock title="สถานะ">
            <FilterChip active={statusFilter === "ทั้งหมด"} onClick={() => setStatusFilter("ทั้งหมด")}>ทั้งหมด</FilterChip>
            {statuses.map((status) => (
              <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                {status}
              </FilterChip>
            ))}
          </FilterBlock>

          <FilterBlock title="สถานที่">
            <FilterChip active={locationFilter === "ทั้งหมด"} onClick={() => setLocationFilter("ทั้งหมด")}>ทั้งหมด</FilterChip>
            {locations.map((location) => (
              <FilterChip key={location} active={locationFilter === location} onClick={() => setLocationFilter(location)}>
                {location}
              </FilterChip>
            ))}
          </FilterBlock>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 py-2">
            <p className="text-sm font-bold text-white">
              พบ {filteredVehicles.length.toLocaleString("th-TH")} คัน
              <span className="ml-2 text-xs text-soft">จากสต็อก {vehicles.length.toLocaleString("th-TH")} คัน</span>
            </p>
            <button type="button" onClick={clearFilters} className="min-h-9 rounded-lg border border-line px-3 text-sm font-bold text-soft transition hover:border-brand hover:text-white">
              ล้าง
            </button>
          </div>
        </SectionCard>

        <SectionCard title="ผลลัพธ์พร้อมส่งต่อ" icon={<Car size={18} />}>
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
              <Loader2 size={22} className="mr-2 animate-spin text-brand" />
              กำลังโหลดสต็อก
            </div>
          ) : visibleVehicles.length ? (
            <>
              <div className="space-y-2">
                {visibleVehicles.map((vehicle) => (
                  <VehicleCard
                    key={`${vehicle.plate}-${vehicle.vin || vehicle.model}`}
                    vehicle={vehicle}
                    copied={copiedPlate === vehicle.plate}
                    onCopy={() => copyVehicle(vehicle)}
                    onShare={() => shareVehicle(vehicle)}
                  />
                ))}
              </div>
              {filteredVehicles.length > visibleVehicles.length && (
                <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-center text-sm font-semibold text-soft">
                  แสดง 80 คันแรก กรองให้แคบลงเพื่อค้นเร็วขึ้น
                </p>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-10 text-center">
              <p className="text-lg font-black text-white">ไม่พบรถตามเงื่อนไข</p>
              <p className="mt-1 text-sm text-soft">ลองค้นเลขท้ายทะเบียน รุ่น หรือเลือกตัวกรองให้น้อยลง</p>
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-soft">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">{children}</div>
    </section>
  );
}

function VehicleCard({
  vehicle,
  copied,
  onCopy,
  onShare
}: {
  vehicle: StockVehicle;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <article className="rounded-lg border border-line bg-[#0b0d11] p-3 transition hover:border-brand/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-black text-white">{vehicle.plate || "-"}</p>
            {vehicle.status && <span className="rounded-full border border-brand/35 bg-brand/10 px-2.5 py-1 text-xs font-black text-brand">{vehicle.status}</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-bold text-[#dbe7f3]">{vehicleName(vehicle)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-soft">ราคา RT</p>
          <p className="text-lg font-black text-brand">{formatMoney(vehicle.salePrice)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-soft sm:grid-cols-4">
        <Info icon={<Tag size={15} />} label="กลุ่ม" value={vehicle.vehicleGroup || "-"} />
        <Info icon={<MapPin size={15} />} label="Location" value={vehicle.parkingLocation || "-"} />
        <Info icon={<Gauge size={15} />} label="ไมล์" value={vehicle.mileage || "-"} />
        <Info icon={<Car size={15} />} label="ปี/เกียร์" value={[vehicle.year, vehicle.gear].filter(Boolean).join(" / ") || "-"} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-ink transition hover:bg-[#31e176]"
        >
          <Copy size={18} />
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-bold text-white transition hover:border-brand"
        >
          <Send size={18} className="text-brand" />
          ส่งต่อ
        </button>
      </div>
    </article>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-soft">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}
