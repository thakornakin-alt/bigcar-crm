"use client";

import { useEffect, useMemo, useState } from "react";
import { Car, CheckCircle2, Loader2, Search, Sparkles, Tag, UserRound, XCircle } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SearchField, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { StockLeadMatch } from "@/lib/stock-matching";

const matchingSignals = ["กลุ่มรถยนต์", "รุ่นรถ", "งบประมาณ", "สถานะพร้อมขาย", "สาขา/Location", "คอมเมนต์ลูกค้า"];

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function formatMoney(value: string) {
  const n = Number(String(value || "").replace(/[^\d.]/g, ""));
  return n ? n.toLocaleString("th-TH") : value || "-";
}

export default function StockMatchesPage() {
  const [matches, setMatches] = useState<StockLeadMatch[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ทั้งหมด");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleMatches = useMemo(() => {
    const term = normalizeText(query);
    return matches.filter((item) => {
      const text = normalizeText([
        item.lead.name,
        item.lead.phone,
        item.lead.vehicleGroup,
        item.vehicle.plate,
        item.vehicle.brand,
        item.vehicle.model,
        item.vehicle.vehicleGroup,
        item.vehicle.parkingLocation,
        item.reasons.join(" ")
      ].join(" "));
      const matchesQuery = !term || text.includes(term);
      const matchesFilter =
        filter === "ทั้งหมด" ||
        (filter === "ตรงงบ" ? item.reasons.includes("ตรงงบประมาณ") : true) ||
        (filter === "รถพร้อมเสนอ" ? item.reasons.includes("รถพร้อมเสนอ") : true);
      return matchesQuery && matchesFilter;
    });
  }, [matches, query, filter]);

  async function loadMatches() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ matches: StockLeadMatch[] }>("/api/stock-matches");
      setMatches(data.matches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการจับคู่ไม่สำเร็จ");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMatches();
  }, []);

  return (
    <PageContainer wide>
      <PageTitle
        title="Smart Stock Matching"
        subtitle="จับคู่ลูกค้ามุ่งหวังกับสต็อกจริงแบบแนะนำเท่านั้น"
        actions={
          <TopMenuButton href="/leads" icon={<UserRound size={18} />} variant="primary">
            ลูกค้ามุ่งหวัง
          </TopMenuButton>
        }
      />

      {error && <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-4">
          <SectionCard title="ค้นหา Match" icon={<Search size={18} />}>
            <SearchField icon={<Search size={18} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นลูกค้า / ทะเบียน / รุ่นรถ / สาขา" />
            <div className="flex flex-wrap gap-2">
              {["ทั้งหมด", "ตรงงบ", "รถพร้อมเสนอ"].map((item) => (
                <FilterChip key={item} active={filter === item} onClick={() => setFilter(item)}>
                  {item}
                </FilterChip>
              ))}
            </div>
            <button type="button" onClick={loadMatches} className="min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
              Refresh Match
            </button>
          </SectionCard>

          <SectionCard title="กฎความปลอดภัย" icon={<CheckCircle2 size={18} />}>
            <SafetyRule ok label="แนะนำรถให้เซลล์ดู" />
            <SafetyRule ok label="แสดงเหตุผลที่จับคู่" />
            <SafetyRule danger label="ไม่ Auto จองรถ" />
            <SafetyRule danger label="ไม่ Auto ทักลูกค้า" />
            <SafetyRule danger label="ไม่ Auto เปลี่ยนสถานะ" />
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title={`รายการแนะนำ ${visibleMatches.length.toLocaleString("th-TH")} รายการ`} icon={<Sparkles size={18} />}>
            {loading ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
                <Loader2 size={22} className="mr-2 animate-spin text-brand" />
                Loading
              </div>
            ) : visibleMatches.length ? (
              visibleMatches.map((item) => <MatchCard key={item.id} item={item} />)
            ) : (
              <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
                ยังไม่มีรถที่ตรงกับลูกค้ามุ่งหวัง
              </div>
            )}
          </SectionCard>

          <SectionCard title="ข้อมูลที่ใช้จับคู่" icon={<Tag size={18} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {matchingSignals.map((signal) => (
                <div key={signal} className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
                  {signal}
                </div>
              ))}
            </div>
          </SectionCard>
        </section>
      </div>
    </PageContainer>
  );
}

function MatchCard({ item }: { item: StockLeadMatch }) {
  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{item.lead.name}</p>
          <p className="mt-1 text-sm text-soft">สนใจ: {item.lead.vehicleGroup} · งบ {item.lead.budget || "-"}</p>
        </div>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-black text-brand">
          {item.score} คะแนน
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-black/20 px-3 py-3">
        <p className="flex items-center gap-2 font-black text-white">
          <Car size={16} className="text-brand" />
          {[item.vehicle.brand, item.vehicle.model, item.vehicle.year].filter(Boolean).join(" ") || "-"}
        </p>
        <p className="mt-1 text-sm text-soft">
          ทะเบียน: {item.vehicle.plate || "-"} · ราคา {formatMoney(item.vehicle.salePrice)} · {item.vehicle.parkingLocation || "-"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.reasons.map((reason) => (
            <span key={reason} className="rounded-full border border-brand/35 px-2.5 py-1 text-xs font-black text-brand">{reason}</span>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a href={`/stock-export?query=${encodeURIComponent(item.vehicle.plate || "")}`} className="flex min-h-10 items-center justify-center rounded-lg bg-brand px-3 text-sm font-black text-ink">
          เปิดข้อมูลรถ
        </a>
        <a href="/leads" className="flex min-h-10 items-center justify-center rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
          เปิดลูกค้า
        </a>
      </div>
    </div>
  );
}

function SafetyRule({ label, ok, danger }: { label: string; ok?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-bold text-white">
      {ok && <CheckCircle2 size={16} className="text-brand" />}
      {danger && <XCircle size={16} className="text-amber-200" />}
      {label}
    </div>
  );
}
