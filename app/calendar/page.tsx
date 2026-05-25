"use client";

import { forwardRef, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Car, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, UserRound, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard } from "@/app/components/ui";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar-events";
import type { CalendarVehicleOption } from "@/lib/vehicle-prep-cases";

type CalendarForm = {
  title: string;
  date: string;
  time: string;
  type: CalendarEventType;
  plate: string;
  customerName: string;
  detail: string;
};

const todayKey = toDateKey(new Date());
const weekDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const eventTypes: Array<{
  value: CalendarEventType;
  label: string;
  dot: string;
  border: string;
  text: string;
  softBg: string;
  icon: typeof Car;
}> = [
  { value: "delivery", label: "นัดส่งมอบ", dot: "bg-emerald-300", border: "border-emerald-300/35", text: "text-emerald-100", softBg: "bg-emerald-300/10", icon: Car },
  { value: "garage_return", label: "รถกลับอู่", dot: "bg-amber-300", border: "border-amber-300/35", text: "text-amber-100", softBg: "bg-amber-300/10", icon: Wrench },
  { value: "customer_appointment", label: "นัดลูกค้า", dot: "bg-red-300", border: "border-red-300/35", text: "text-red-100", softBg: "bg-red-300/10", icon: UserRound },
  { value: "other", label: "อื่นๆ", dot: "bg-zinc-200", border: "border-zinc-300/35", text: "text-zinc-100", softBg: "bg-zinc-300/10", icon: CalendarDays }
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function thaiMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(date);
}

function thaiLongDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function typeMeta(type: CalendarEventType) {
  return eventTypes.find((item) => item.value === type) || eventTypes[3];
}

function emptyForm(date: string): CalendarForm {
  return {
    title: "",
    date,
    time: "",
    type: "customer_appointment",
    plate: "",
    customerName: "",
    detail: ""
  };
}

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Calendar request failed");
  return data as T;
}

export default function CalendarPage() {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<CalendarVehicleOption[]>([]);
  const [form, setForm] = useState<CalendarForm>(() => emptyForm(todayKey));
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const from = toDateKey(monthStart(month));
  const to = toDateKey(monthEnd(month));

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ events: CalendarEvent[] }>(`/api/calendar/events?from=${from}&to=${to}`);
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดปฏิทินไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    api<{ vehicles: CalendarVehicleOption[] }>("/api/vehicle-prep/calendar-options")
      .then((data) => setVehicleOptions(data.vehicles || []))
      .catch(() => setVehicleOptions([]));
  }, []);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [events]);

  const selectedEvents = eventsByDate[selectedDate] || [];
  const days = useMemo(() => buildMonthGrid(month), [month]);

  function selectDate(date: string) {
    setSelectedDate(date);
    setForm((current) => ({ ...current, date }));
    setMessage("");
    setError("");
  }

  function goToday() {
    const now = new Date();
    setMonth(monthStart(now));
    selectDate(toDateKey(now));
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const data = await api<{ event: CalendarEvent }>("/api/calendar/events", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setEvents((current) => [...current, data.event].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
      setForm(emptyForm(form.date));
      setTitleManuallyEdited(false);
      setMessage("เพิ่มงานลงปฏิทินแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function selectVehicle(bookingId: string) {
    const vehicle = vehicleOptions.find((item) => item.bookingId === bookingId);
    if (!vehicle) {
      updateFormWithAutoTitle({ plate: "", customerName: "" });
      return;
    }

    updateFormWithAutoTitle({
      plate: vehicle.plate,
      customerName: vehicle.customerName,
      detail: form.detail || [vehicle.model, vehicle.owner].filter(Boolean).join("\n")
    });
  }

  function autoTitle(next: CalendarForm) {
    if (next.type === "other") return "";
    return [typeMeta(next.type).label, next.plate, next.customerName].filter(Boolean).join(" ").trim();
  }

  function updateFormWithAutoTitle(patch: Partial<CalendarForm>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      return titleManuallyEdited ? next : { ...next, title: autoTitle(next) };
    });
  }

  function updateEventType(type: CalendarEventType) {
    setTitleManuallyEdited(false);
    setForm((current) => {
      const next = { ...current, type };
      return { ...next, title: autoTitle(next) };
    });
    if (type === "other") {
      window.setTimeout(() => titleInputRef.current?.focus(), 0);
    }
  }

  function updateTitle(value: string) {
    setTitleManuallyEdited(true);
    setForm((current) => ({ ...current, title: value }));
  }

  async function deleteEvent(id: string) {
    setDeletingId(id);
    setMessage("");
    setError("");

    try {
      await api<{ ok: true }>(`/api/calendar/events/${id}`, { method: "DELETE" });
      setEvents((current) => current.filter((event) => event.id !== id));
      setMessage("ลบงานออกจากปฏิทินแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบงานไม่สำเร็จ");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <PageContainer wide>
      <PageTitle title="ปฏิทิน" subtitle="ปฏิทินจริงสำหรับงานลูกค้า งานรถ และงานเซลล์" />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">{thaiMonthLabel(month)}</h2>
              <p className="text-sm text-soft">{loading ? "กำลังโหลดงาน..." : `มีงานในเดือนนี้ ${events.length} รายการ`}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMonth((current) => addMonths(current, -1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-brand">
                <ChevronLeft size={19} />
              </button>
              <button type="button" onClick={goToday} className="min-h-11 rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
                วันนี้
              </button>
              <button type="button" onClick={() => setMonth((current) => addMonths(current, 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-brand">
                <ChevronRight size={19} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-black text-soft">
            {weekDays.map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="min-h-[92px] rounded-lg border border-transparent sm:min-h-[112px]" />;

              const dayEvents = eventsByDate[day] || [];
              const active = day === selectedDate;
              const isToday = day === todayKey;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`min-h-[92px] rounded-lg border p-1.5 text-left transition sm:min-h-[112px] sm:p-2 ${
                    active
                      ? "border-brand bg-brand/12 shadow-glow"
                      : isToday
                        ? "border-brand/40 bg-[#0b0d11]"
                        : "border-line bg-[#0b0d11] hover:border-brand/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${isToday ? "bg-brand text-ink" : "text-white"}`}>
                      {Number(day.slice(-2))}
                    </span>
                    {dayEvents.length > 0 && <span className="text-[11px] font-black text-brand">{dayEvents.length}</span>}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => {
                      const meta = typeMeta(event.type);
                      return (
                        <div key={event.id} className={`truncate rounded-md border ${meta.border} ${meta.softBg} px-1.5 py-1 text-[10px] font-black ${meta.text}`}>
                          {event.time ? `${event.time} ` : ""}{event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && <div className="text-[10px] font-bold text-soft">+{dayEvents.length - 2} งาน</div>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {eventTypes.map((type) => (
              <span key={type.value} className={`inline-flex min-h-8 items-center gap-2 rounded-full border ${type.border} px-3 text-xs font-black ${type.text}`}>
                <span className={`h-2 w-2 rounded-full ${type.dot}`} />
                {type.label}
              </span>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="สร้างงาน" icon={<Plus size={18} />}>
            <form onSubmit={saveEvent} className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-bold text-soft">ประเภทงาน</p>
                <div className="grid grid-cols-2 gap-2">
                  {eventTypes.map((type) => (
                    <FilterChip key={type.value} active={form.type === type.value} onClick={() => updateEventType(type.value)}>
                      {type.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <CalendarField ref={titleInputRef} label="ชื่องาน" value={form.title} onChange={updateTitle} placeholder="เช่น นัดส่งมอบ / ติดตามลูกค้า" />
                <CalendarField label="วันที่" type="date" value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} />
                <CalendarField label="เวลา" type="time" value={form.time} onChange={(value) => setForm((current) => ({ ...current, time: value }))} />
                <VehicleSelect vehicles={vehicleOptions} value={form.plate} onSelect={selectVehicle} />
                <CalendarField label="ทะเบียน" value={form.plate} onChange={(value) => updateFormWithAutoTitle({ plate: value })} placeholder="พิมพ์เองได้ ถ้าเป็นงานทั่วไป" />
                <CalendarField label="ลูกค้า" value={form.customerName} onChange={(value) => updateFormWithAutoTitle({ customerName: value })} placeholder="ชื่อลูกค้า (ถ้ามี)" />
              </div>

              <label className="block">
                <span className="text-xs font-bold text-soft">รายละเอียด</span>
                <textarea
                  value={form.detail}
                  onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))}
                  placeholder="สาขา หมายเหตุ หรือสิ่งที่ต้องทำ"
                  className="mt-1 min-h-[92px] w-full rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-[#6f7785] focus:border-brand"
                />
              </label>

              <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-60">
                <Plus size={18} />
                {saving ? "กำลังเพิ่มงาน..." : "เพิ่มงานลงปฏิทิน"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title={thaiLongDate(selectedDate)} icon={<CalendarDays size={18} />}>
            {message && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-100">{message}</p>}
            {error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm font-bold text-red-100">{error}</p>}

            {selectedEvents.length === 0 ? (
              <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-6 text-center text-sm font-bold text-soft">
                วันนี้ยังไม่มีงาน
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((event) => {
                  const meta = typeMeta(event.type);
                  const Icon = meta.icon;
                  return (
                    <article key={event.id} className={`rounded-xl border ${meta.border} bg-[#0b0d11] p-3`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-brand">
                          <Icon size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {event.time && (
                              <span className="inline-flex items-center gap-1 text-sm font-black text-white">
                                <Clock3 size={15} className="text-brand" />
                                {event.time}
                              </span>
                            )}
                            <span className={`rounded-full border ${meta.border} px-2 py-0.5 text-xs font-black ${meta.text}`}>
                              {meta.label}
                            </span>
                          </div>
                          <h3 className="mt-1 text-base font-black text-white">{event.title}</h3>
                          {(event.plate || event.customerName) && (
                            <p className="mt-1 text-sm font-bold text-soft">
                              {[event.plate && `ทะเบียน ${event.plate}`, event.customerName].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {event.detail && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-soft">{event.detail}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteEvent(event.id)}
                          disabled={deletingId === event.id}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-red-100 transition hover:border-red-300 disabled:opacity-50"
                          aria-label="ลบงาน"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}

function buildMonthGrid(date: Date) {
  const start = monthStart(date);
  const totalDays = monthEnd(date).getDate();
  const cells: Array<string | null> = [];

  for (let i = 0; i < start.getDay(); i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(toDateKey(new Date(date.getFullYear(), date.getMonth(), day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const CalendarField = forwardRef<HTMLInputElement, {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date" | "time";
}>(function CalendarField({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}, ref) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-soft">{label}</span>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none transition placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
});

function VehicleSelect({
  vehicles,
  value,
  onSelect
}: {
  vehicles: CalendarVehicleOption[];
  value: string;
  onSelect: (bookingId: string) => void;
}) {
  const selected = vehicles.find((vehicle) => vehicle.plate === value);

  return (
    <label className="block">
      <span className="text-xs font-bold text-soft">ทะเบียนรอส่งมอบ</span>
      <select
        value={selected?.bookingId || ""}
        onChange={(event) => onSelect(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none transition focus:border-brand"
      >
        <option value="">เลือกจากรถที่รอส่งมอบ</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.bookingId} value={vehicle.bookingId}>
            {vehicle.plate} · {vehicle.customerName || "-"} · {vehicle.model}
          </option>
        ))}
      </select>
      {!vehicles.length && <p className="mt-1 text-[11px] text-soft">ยังไม่มีทะเบียนในรอส่งมอบ</p>}
    </label>
  );
}
