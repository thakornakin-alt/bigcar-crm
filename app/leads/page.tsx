"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Car, Loader2, Phone, Save, Search, Sparkles, UserRound } from "lucide-react";
import { FilterChip, NativeAppHeader, NativeAppShell, NativeBadge, NativeButton, SearchField, SectionCard } from "@/app/components/ui";
import type { StockVehicle } from "@/lib/types";
import type { SalesLead } from "@/lib/leads";

type LeadForm = {
  name: string;
  phone: string;
  vehicleGroup: string;
  desiredModel: string;
  budget: string;
  comment: string;
  status: SalesLead["status"];
  nextFollowUpDate: string;
};

const blankForm: LeadForm = {
  name: "",
  phone: "",
  vehicleGroup: "",
  desiredModel: "",
  budget: "",
  comment: "",
  status: "new",
  nextFollowUpDate: ""
};

const fallbackGroups = ["VAN", "PICK-UP CAB", "PICK-UP D-CAB", "SUV", "SEDAN", "MPV"];
const leadStages = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "ใหม่วันนี้" },
  { key: "follow_up", label: "ต้องติดตาม" },
  { key: "waiting_stock", label: "รอรถตรงรุ่น" }
] as const;

const leadStatusOptions: Array<{ value: NonNullable<SalesLead["status"]>; label: string }> = [
  { value: "new", label: "ลูกค้าใหม่" },
  { value: "follow_up", label: "ต้องติดตาม" },
  { value: "waiting_stock", label: "รอรถตรงรุ่น" },
  { value: "closed", label: "ปิดเคส" }
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
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function mappedVehicleGroup(value: string, groups: string[]) {
  const raw = String(value || "").trim();
  const compact = normalizeText(raw);
  const exact = groups.find((group) => normalizeText(group) === compact);
  if (exact) return exact;

  if (/(van|รถตู้|commuter|คอมมิวเตอร์|ตู้)/i.test(raw)) return findGroup(groups, ["van"]) || "VAN";
  if (/(prerunner|ยกสูง|4wd|ขับ4|โฟวิว|โฟร์วิว|กระบะ|revo|รีโว่)/i.test(raw)) {
    return findGroup(groups, ["pick-up", "pickup", "cab"]) || "PICK-UP CAB";
  }
  if (/(suv|fortuner|ฟอร์จูน|ppv)/i.test(raw)) return findGroup(groups, ["suv"]) || "SUV";
  return raw;
}

function findGroup(groups: string[], keywords: string[]) {
  return groups.find((group) => {
    const text = normalizeText(group);
    return keywords.every((keyword) => text.includes(normalizeText(keyword)));
  });
}

function legacyToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<string[]>(fallbackGroups);
  const [form, setForm] = useState<LeadForm>(blankForm);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<(typeof leadStages)[number]["key"]>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const today = legacyToday();
  const newTodayCount = leads.filter((lead) => lead.date === today).length;

  const visibleLeads = useMemo(() => {
    const term = normalizeText(query);
    return leads.filter((lead) => {
      const matchesQuery = !term || normalizeText([lead.name, lead.phone, lead.vehicleGroup, lead.desiredModel, lead.budget, lead.comment].join(" ")).includes(term);
      const matchesStage =
        stage === "all" ||
        (stage === "today" ? lead.date === today : lead.status === stage);
      return matchesQuery && matchesStage;
    });
  }, [leads, query, stage, today]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [customerData, stockData] = await Promise.all([
        api<{ leads: SalesLead[] }>("/api/leads"),
        api<{ vehicles: StockVehicle[] }>("/api/stock/list?limit=500").catch(() => ({ vehicles: [] }))
      ]);
      setLeads(customerData.leads || []);
      const stockGroups = Array.from(
        new Set((stockData.vehicles || []).map((vehicle) => String(vehicle.vehicleGroup || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "th"));
      setVehicleGroups(stockGroups.length ? stockGroups : fallbackGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดลูกค้ามุ่งหวังไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function update<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const vehicleGroup = mappedVehicleGroup(form.vehicleGroup, vehicleGroups);
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          vehicleGroup,
          desiredModel: form.desiredModel,
          budget: form.budget,
          comment: form.comment,
          status: form.status,
          nextFollowUpDate: form.nextFollowUpDate
        })
      });
      setForm(blankForm);
      await loadData();
      setMessage("บันทึกลูกค้ามุ่งหวังแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <NativeAppShell className="max-w-5xl">
      <NativeAppHeader
        title="ลูกค้ามุ่งหวัง"
        subtitle="เก็บลูกค้าที่กำลังหารถ และติดตามต่อได้เร็ว"
        actions={<NativeBadge>{visibleLeads.length.toLocaleString("th-TH")} ราย</NativeBadge>}
      />

      {(message || error) && (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-green-950/30 text-green-100"}`}>
          {error || message}
        </div>
      )}

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <SummaryCard label="ลูกค้ามุ่งหวังทั้งหมด" value={`${leads.length.toLocaleString("th-TH")} ราย`} />
        <SummaryCard label="ลูกค้าใหม่วันนี้" value={`${newTodayCount.toLocaleString("th-TH")} ราย`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <SectionCard title="เพิ่มลูกค้ามุ่งหวัง" icon={<UserRound size={18} />}>
            <form onSubmit={saveLead} className="space-y-3">
              <Field label="ชื่อ" value={form.name} onChange={(value) => update("name", value)} icon={<UserRound size={16} />} required />
              <Field label="เบอร์" value={form.phone} onChange={(value) => update("phone", value)} icon={<Phone size={16} />} inputMode="tel" required />
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">กลุ่มรถยนต์</span>
                <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#080c12] px-3 focus-within:border-brand/80">
                  <Car size={16} className="text-brand" />
                  <input
                    value={form.vehicleGroup}
                    onChange={(event) => update("vehicleGroup", event.target.value)}
                    list="lead-vehicle-groups"
                    placeholder="เช่น รีโว่ยกสูง / Van / Prerunner"
                    className="h-12 w-full bg-transparent text-white outline-none placeholder:text-[#6f7785]"
                    required
                  />
                </span>
                <datalist id="lead-vehicle-groups">
                  {vehicleGroups.map((group) => <option key={group} value={group} />)}
                </datalist>
              </label>
              <Field label="รุ่นที่สนใจ" value={form.desiredModel} onChange={(value) => update("desiredModel", value)} icon={<Car size={16} />} placeholder="เช่น รีโว่ยกสูง / Commuter / Fortuner" />
              <Field label="งบประมาณ" value={form.budget} onChange={(value) => update("budget", value)} icon={<Sparkles size={16} />} placeholder="เช่น 800,000 - 1,000,000" />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">สถานะติดตาม</span>
                  <select
                    value={form.status}
                    onChange={(event) => update("status", event.target.value as LeadForm["status"])}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none focus:border-brand/80"
                  >
                    {leadStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">วันติดตามถัดไป</span>
                  <input
                    type="date"
                    value={form.nextFollowUpDate}
                    onChange={(event) => update("nextFollowUpDate", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none focus:border-brand/80"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">คอมเม้นเพิ่มเติม</span>
                <textarea
                  value={form.comment}
                  onChange={(event) => update("comment", event.target.value)}
                  rows={4}
                  placeholder="รายละเอียดที่ต้องติดตาม"
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand/80"
                />
              </label>
              <NativeButton type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 size={19} className="animate-spin" /> : <Save size={19} />}
                บันทึกลูกค้ามุ่งหวัง
              </NativeButton>
            </form>
          </SectionCard>
        </section>

        <section className="space-y-4">
          <SectionCard title="ค้นหาและติดตาม" icon={<Search size={18} />}>
            <SearchField icon={<Search size={18} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นชื่อ / เบอร์ / กลุ่มรถ / คอมเม้น" />
            <div className="flex flex-wrap gap-2">
              {leadStages.map((item) => (
                <FilterChip key={item.key} active={stage === item.key} onClick={() => setStage(item.key)}>
                  {item.label}
                </FilterChip>
              ))}
            </div>
            {loading ? (
              <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-[#080c12] text-soft">
                <Loader2 size={22} className="mr-2 animate-spin text-brand" />
                กำลังโหลด
              </div>
            ) : visibleLeads.length ? (
              <div className="space-y-2">
                {visibleLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#080c12] px-4 py-8 text-center text-soft">
                ไม่พบลูกค้ามุ่งหวัง
              </div>
            )}
          </SectionCard>
        </section>
      </div>
    </NativeAppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
  placeholder,
  required,
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#080c12] px-3 focus-within:border-brand/80">
        <span className="text-brand">{icon}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          type="text"
          className="h-12 w-full bg-transparent text-white outline-none placeholder:text-[#6f7785]"
        />
      </span>
    </label>
  );
}

function LeadCard({ lead }: { lead: SalesLead }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#080c12] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{lead.name}</p>
          <p className="mt-1 text-sm text-soft">{lead.phone} · {lead.vehicleGroup}</p>
          {lead.desiredModel && <p className="mt-1 text-xs font-bold text-brand">สนใจ: {lead.desiredModel}</p>}
          <p className="mt-1 text-xs text-soft">วันที่บันทึก: {lead.date || "-"}</p>
        </div>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-black text-brand">{statusLabel(lead.status)}</span>
      </div>
      {(lead.budget || lead.comment) && (
        <p className="mt-3 whitespace-pre-line rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-soft">
          {lead.budget ? `งบประมาณ: ${lead.budget}` : ""}
          {lead.budget && lead.comment ? "\n" : ""}
          {lead.comment}
          {lead.nextFollowUpDate ? `\nติดตามถัดไป: ${formatThaiDate(lead.nextFollowUpDate)}` : ""}
        </p>
      )}
    </div>
  );
}

function statusLabel(status?: SalesLead["status"]) {
  return leadStatusOptions.find((option) => option.value === status)?.label || "ลูกค้าใหม่";
}

function formatThaiDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,#101720,#070b10)] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.22)]">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-soft">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
