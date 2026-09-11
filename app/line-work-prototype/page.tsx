"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, MessageCircle, RotateCcw, Search, X } from "lucide-react";

type WorkStatus = "pending" | "done" | "blocked";

type WorkItem = {
  id: string;
  label: string;
  status: WorkStatus;
};

const seedTasks: WorkItem[] = [
  { id: "wash", label: "ล้างรถ", status: "pending" },
  { id: "spa", label: "สปาเต็มระบบ", status: "done" },
  { id: "order-oil", label: "สั่งเปลี่ยนน้ำมันเครื่อง", status: "done" },
  { id: "oil", label: "เปลี่ยนน้ำมันเครื่อง", status: "pending" },
  { id: "order-battery", label: "สั่งเปลี่ยนแบต", status: "blocked" },
  { id: "battery", label: "เปลี่ยนแบต", status: "pending" },
  { id: "decal", label: "ลอกลาย", status: "pending" },
  { id: "insurance", label: "ประกัน", status: "pending" }
];

const statusText: Record<WorkStatus, string> = {
  pending: "ยังไม่ทำ",
  done: "ทำแล้ว ✅",
  blocked: "ทำไม่ได้ ❌"
};

function formatThaiDate(value: string) {
  if (!value) return "ยังไม่ระบุ";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function StatusButtons({ value, onChange }: { value: WorkStatus; onChange: (value: WorkStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="เลือกสถานะงาน">
      <button
        type="button"
        onClick={() => onChange("pending")}
        className={`rounded-full border px-2.5 py-1 text-xs font-black transition ${
          value === "pending" ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 bg-white/5 text-white/65"
        }`}
      >
        ยังไม่ทำ
      </button>
      <button
        type="button"
        onClick={() => onChange("done")}
        className={`rounded-full border px-2.5 py-1 text-xs font-black transition ${
          value === "done" ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/15 bg-white/5 text-white/65"
        }`}
      >
        ทำแล้ว ✅
      </button>
      <button
        type="button"
        onClick={() => onChange("blocked")}
        className={`rounded-full border px-2.5 py-1 text-xs font-black transition ${
          value === "blocked" ? "border-rose-400 bg-rose-400 text-black" : "border-white/15 bg-white/5 text-white/65"
        }`}
      >
        ทำไม่ได้ ❌
      </button>
    </div>
  );
}

export default function LineWorkPrototypePage() {
  const [mode, setMode] = useState<"line" | "web">("line");
  const [query, setQuery] = useState("3405");
  const [searched, setSearched] = useState("3405");
  const [tasks, setTasks] = useState(seedTasks);
  const [garageOutDate, setGarageOutDate] = useState("2026-09-10");
  const [garageReturnDate, setGarageReturnDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("2026-09-15");
  const [activity, setActivity] = useState<string[]>(["เปิดดูงานทั้งหมดของทะเบียน 3405"]);
  const [notice, setNotice] = useState("");

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);

  function recordActivity(message: string) {
    setActivity((items) => [`${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} · ${message}`, ...items].slice(0, 5));
  }

  function updateTask(id: string, status: WorkStatus) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;
    setTasks((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
    recordActivity(`${task.label} → ${statusText[status]}`);
    setNotice(`บันทึก “${task.label}” ลงข้อมูลชุดเดียวกับเว็บแล้ว`);
  }

  function updateDate(label: string, value: string, setter: (value: string) => void) {
    setter(value);
    recordActivity(`${label} → ${formatThaiDate(value)}`);
    setNotice(`อัปเดต${label}แล้ว`);
  }

  function searchVehicle() {
    const normalized = query.replace(/\s+/g, "").slice(-4) || "3405";
    setSearched(normalized);
    recordActivity(`ค้นทะเบียน ${normalized}`);
    setNotice(normalized === "3405" ? "พบรถตัวอย่าง 1 คัน" : "ต้นแบบแสดงรถจำลองสำหรับทดสอบการใช้งาน");
  }

  function resetDemo() {
    setTasks(seedTasks);
    setGarageOutDate("2026-09-10");
    setGarageReturnDate("");
    setDeliveryDate("2026-09-15");
    setActivity(["รีเซ็ตข้อมูลตัวอย่าง"]);
    setNotice("กลับเป็นข้อมูลเริ่มต้นแล้ว");
  }

  function sendPendingSummary() {
    const labels = pendingTasks.map((task) => `${task.label} (${statusText[task.status]})`).join(" · ");
    setNotice(labels ? `LINE จะแจ้ง ${pendingTasks.length} งาน: ${labels}` : "คันนี้ไม่มีงานค้าง");
    recordActivity("สร้างสรุปงานค้างสำหรับส่งเข้า LINE");
  }

  const tracker = (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#121820] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#20d46b]">Booking Delivery</p>
            <h2 className="mt-1 text-xl font-black text-white">ทะเบียนตัวอย่าง · {searched}</h2>
            <p className="mt-1 text-sm text-white/60">TOYOTA CAMRY 2.5 HEV · ลูกค้าตัวอย่าง</p>
          </div>
          <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-black">ค้าง {pendingTasks.length}</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-white/10 bg-[#0b1016] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`grid size-7 place-items-center rounded-full ${
                  task.status === "done" ? "bg-emerald-400 text-black" : task.status === "blocked" ? "bg-rose-400 text-black" : "bg-amber-300 text-black"
                }`}
              >
                {task.status === "done" ? <Check size={16} strokeWidth={3} /> : task.status === "blocked" ? <X size={16} strokeWidth={3} /> : "•"}
              </span>
              <p className="font-black text-white">{task.label}</p>
            </div>
            <StatusButtons value={task.status} onChange={(status) => updateTask(task.id, status)} />
          </div>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {[
          ["วันส่งอู่", garageOutDate, setGarageOutDate],
          ["วันรถกลับ", garageReturnDate, setGarageReturnDate],
          ["วันส่งมอบ", deliveryDate, setDeliveryDate]
        ].map(([label, value, setter]) => (
          <label key={String(label)} className="rounded-2xl border border-white/10 bg-[#0b1016] p-3">
            <span className="mb-2 flex items-center gap-2 text-sm font-black text-white">
              <CalendarDays size={16} className="text-[#20d46b]" /> {String(label)}
            </span>
            <input
              type="date"
              value={String(value)}
              onChange={(event) => updateDate(String(label), event.target.value, setter as (value: string) => void)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#20d46b]"
            />
            <span className="mt-2 block text-xs text-white/45">{formatThaiDate(String(value))}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-[#20d46b]/30 bg-[#20d46b]/10 px-3 py-1 text-xs font-black text-[#20d46b]">
              ต้นแบบทดลอง · ไม่แก้ข้อมูลจริง
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">ติดตามงานรถผ่าน LINE</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              ค้นด้วยเลขทะเบียน ดูหัวข้องานทั้งหมด และอัปเดตข้อมูลเดียวกับ Booking Delivery จาก LINE หรือเว็บก็ได้
            </p>
          </div>
          <button type="button" onClick={resetDemo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black">
            <RotateCcw size={16} /> เริ่มทดลองใหม่
          </button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#11161d] px-4">
            <Search size={18} className="text-white/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && searchVehicle()}
              placeholder="พิมพ์ทะเบียนเต็มหรือเลขท้าย 4 ตัว"
              className="w-full bg-transparent text-base font-bold text-white outline-none placeholder:text-white/30"
            />
          </label>
          <button type="button" onClick={searchVehicle} className="min-h-12 rounded-2xl bg-[#20d46b] px-6 font-black text-black">
            ติดตามทั้งหมด
          </button>
        </div>

        <div className="mb-5 inline-flex rounded-2xl border border-white/10 bg-[#0b0f14] p-1">
          <button type="button" onClick={() => setMode("line")} className={`rounded-xl px-4 py-2 text-sm font-black ${mode === "line" ? "bg-[#20d46b] text-black" : "text-white/55"}`}>
            มุมมอง LINE
          </button>
          <button type="button" onClick={() => setMode("web")} className={`rounded-xl px-4 py-2 text-sm font-black ${mode === "web" ? "bg-[#20d46b] text-black" : "text-white/55"}`}>
            มุมมองเว็บ
          </button>
        </div>

        {notice && (
          <div className="mb-5 rounded-2xl border border-[#20d46b]/30 bg-[#20d46b]/10 px-4 py-3 text-sm font-bold text-emerald-100">
            {notice}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {mode === "line" ? (
            <section className="mx-auto w-full max-w-[480px] overflow-hidden rounded-[2.25rem] border-[8px] border-[#20252c] bg-[#769ac9] shadow-2xl">
              <div className="flex items-center justify-between bg-[#90afd7] px-4 py-3 text-sm font-black text-[#10223c]">
                <span>‹ ขายรถบิ๊กฝ้าย 2</span>
                <span>⌕ ☎︎ ☰</span>
              </div>
              <div className="space-y-3 p-4">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#54e472] px-4 py-3 text-sm font-bold text-black">
                  ติดตามทั้งหมด ทะเบียน {searched}
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-white p-3 text-[#111820] shadow-lg">
                  {tracker}
                  <button type="button" onClick={sendPendingSummary} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#20d46b] px-4 py-3 text-sm font-black text-black">
                    <MessageCircle size={17} /> ส่งสรุปงานค้างลงกลุ่ม
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-[#0d1218] p-4 shadow-2xl sm:p-6">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-black text-[#20d46b]">BIG CAR CRM</p>
                  <p className="text-xs text-white/45">Booking Delivery · แก้ไขได้</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/60">ข้อมูลชุดเดียวกับ LINE</span>
              </div>
              {tracker}
            </section>
          )}

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-[#11161d] p-5">
              <p className="text-sm font-black text-white">ประวัติการอัปเดตตัวอย่าง</p>
              <div className="mt-3 space-y-2">
                {activity.map((item, index) => (
                  <p key={`${item}-${index}`} className="rounded-xl bg-black/25 px-3 py-2 text-xs leading-5 text-white/55">{item}</p>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
              <p className="text-sm font-black text-amber-200">กติกาเดียวที่ต้องจำ</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/70">ไม่มีเครื่องหมายคือยังไม่ทำ · ✅ คือทำแล้ว · ❌ คือทำไม่ได้</p>
              <p className="mt-2 text-xs leading-5 text-amber-50/45">งานที่ยังไม่ทำและทำไม่ได้จะอยู่ในสรุปติดตามต่อ จนกว่าจะเปลี่ยนเป็นทำแล้ว</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
