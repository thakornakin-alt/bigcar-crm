"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  DatabaseZap,
  Loader2,
  Mail,
  Radio,
  Search,
  Send,
  ShieldCheck,
  XCircle,
  Zap
} from "lucide-react";
import { FilterSummaryPill, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { RealtimePaymentType, RealtimeQueueStatus } from "@/lib/realtime-booking";

type QueueItem = {
  id: string;
  plate: string;
  customerName: string;
  discount: number;
  paymentType: RealtimePaymentType;
  saleName: string;
  waitingOrder: number;
  status: RealtimeQueueStatus;
  createdAt: string;
  matchedAt?: string;
  rtPrice?: number;
  finalPrice?: number;
  bookingText?: string;
  note?: string;
  lineStatus?: "not_sent" | "sent" | "failed";
  lineSentAt?: string;
  lineTargetId?: string;
  lineError?: string;
};

type MailLog = {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  receivedAt: string;
  status: string;
  vehicleCount: number;
  matchedCount: number;
  durationMs: number;
  error?: string;
};

type DashboardData = {
  vehicleCount: number;
  waiting: number;
  matched: number;
  booked: number;
  duplicated: number;
  cancelled: number;
  onlineUsers: number;
  lastSyncAt: string;
  latestMail: MailLog | null;
  queue: QueueItem[];
  mailLogs: MailLog[];
};

type LineGroup = {
  groupId: string;
  type: string;
  name: string;
  lastSeenAt: string;
};

const blankForm = {
  plate: "",
  customerName: "",
  discount: "10000",
  paymentType: "finance" as RealtimePaymentType,
  saleName: "ฐากร บิ๊ก ทีมพี่ลีฟ"
};

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

function money(value?: number) {
  if (!value) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function time(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

export default function RealtimeBookingPage() {
  const [form, setForm] = useState(blankForm);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [sendingLineId, setSendingLineId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [lineTargetId, setLineTargetId] = useState("");
  const [autoSendLine, setAutoSendLine] = useState(false);

  async function loadDashboard() {
    const data = await api<DashboardData>("/api/realtime-booking/dashboard");
    setDashboard(data);
    return data;
  }

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));
    api<{ groups: LineGroup[] }>("/api/line/groups")
      .then((data) => {
        setLineGroups(data.groups || []);
        if (data.groups?.[0]?.groupId) setLineTargetId(data.groups[0].groupId);
      })
      .catch(() => undefined);
    const timer = window.setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredQueue = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/\s+/g, "");
    const queue = dashboard?.queue || [];
    if (!term) return queue;
    return queue.filter((item) =>
      [item.plate, item.customerName, item.saleName, item.status]
        .join("")
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes(term)
    );
  }, [dashboard?.queue, query]);

  async function handleWaiting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await api<{ item: QueueItem }>("/api/realtime-booking/waiting", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          discount: Number(form.discount || 0)
        })
      });
      setForm((current) => ({ ...current, plate: "", customerName: "" }));
      if (autoSendLine && data.item.status === "MATCHED" && lineTargetId) {
        await sendLine(data.item, true);
      }
      await loadDashboard();
      setMessage(data.item.status === "MATCHED" ? "Match ราคา RT สำเร็จ พร้อม Copy ข้อความ" : "บันทึก Waiting Queue แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกคิวไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function simulateMailSync() {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      await api("/api/realtime-booking/prices", {
        method: "POST",
        body: JSON.stringify({
          subject: "Pricing and Status Update",
          sender: "rdd-pricing@segroup.co.th",
          recipient: "retail-bangna@bigcarrdd.local",
          rows: [
            { plate: "1ขห 9832", rtPrice: 764000 },
            { plate: "1นข 4313", rtPrice: 912000 },
            { plate: "3ฒศ 4326", rtPrice: 324000 }
          ]
        })
      });
      const latest = await loadDashboard();
      if (autoSendLine && lineTargetId) {
        await sendPendingMatched(latest);
      }
      setMessage("จำลอง Gmail Push + Parse ราคา RT แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync ราคาไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  }

  async function syncRealGmail() {
    setGmailSyncing(true);
    setError("");
    setMessage("");

    try {
      const result = await api<{ checked: number; processed: unknown[] }>("/api/realtime-booking/gmail-sync", {
        method: "POST",
        body: JSON.stringify({ maxResults: 5 })
      });
      const latest = await loadDashboard();
      if (autoSendLine && lineTargetId) {
        await sendPendingMatched(latest);
      }
      setMessage(`Sync Gmail จริงแล้ว: ตรวจ ${result.checked} เมล / process ${result.processed.length} รายการ`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync Gmail จริงไม่สำเร็จ");
    } finally {
      setGmailSyncing(false);
    }
  }

  async function copyText(text?: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMessage("Copy ข้อความจองแล้ว");
  }

  async function markBooked(item: QueueItem) {
    try {
      await api("/api/realtime-booking/book", {
        method: "POST",
        body: JSON.stringify({ id: item.id })
      });
      await loadDashboard();
      setMessage(`Lock จองทะเบียน ${item.plate} แล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lock จองไม่สำเร็จ");
    }
  }

  async function sendLine(item: QueueItem, silent = false) {
    if (!lineTargetId) {
      setError("กรุณาเลือก LINE group ก่อนส่ง");
      return;
    }

    setSendingLineId(item.id);
    setError("");
    if (!silent) setMessage("");

    try {
      await api("/api/realtime-booking/send-line", {
        method: "POST",
        body: JSON.stringify({ id: item.id, targetId: lineTargetId })
      });
      await loadDashboard();
      if (!silent) setMessage(`ส่ง LINE สำหรับทะเบียน ${item.plate} แล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง LINE ไม่สำเร็จ");
    } finally {
      setSendingLineId("");
    }
  }

  async function sendPendingMatched(data: DashboardData) {
    const pending = data.queue.filter((item) => item.status === "MATCHED" && item.lineStatus !== "sent" && item.bookingText);
    for (const item of pending.slice(0, 5)) {
      await sendLine(item, true);
    }
  }

  async function cancelQueue(item: QueueItem) {
    const confirmed = window.confirm(`ยกเลิกคิวทะเบียน ${item.plate} ใช่ไหม?`);
    if (!confirmed) return;

    try {
      await api("/api/realtime-booking/cancel", {
        method: "POST",
        body: JSON.stringify({ id: item.id, reason: "ยกเลิกโดยเซลส์" })
      });
      await loadDashboard();
      setMessage(`ยกเลิกคิวทะเบียน ${item.plate} แล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกคิวไม่สำเร็จ");
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="Realtime Booking Queue"
        subtitle="กรอกคิวไว้ก่อน ระบบรอเมลราคา RT แล้ว Match / ส่ง LINE ให้อัตโนมัติ"
        actions={
          <>
            <TopMenuButton href="/" icon={<ArrowLeft size={18} />}>หน้าแรก</TopMenuButton>
            <TopMenuButton href="/booking-reports" icon={<Send size={18} />}>รายงานจอง</TopMenuButton>
          </>
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={<DatabaseZap size={18} />} label="รถ RT" value={dashboard?.vehicleCount || 0} />
        <Metric icon={<Clock3 size={18} />} label="Waiting" value={dashboard?.waiting || 0} />
        <Metric icon={<Zap size={18} />} label="Matched" value={dashboard?.matched || 0} />
        <Metric icon={<ShieldCheck size={18} />} label="Booked" value={dashboard?.booked || 0} />
        <Metric icon={<Radio size={18} />} label="Online" value={dashboard?.onlineUsers || 0} />
      </section>

      {(message || error) && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
            error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-cyan-300/40 bg-cyan-950/25 text-cyan-100"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="เพิ่มคิวจองด่วน" icon={<Zap size={18} />}>
          <form onSubmit={handleWaiting} className="space-y-3">
            <Field label="ทะเบียนรถ" value={form.plate} onChange={(value) => setForm((cur) => ({ ...cur, plate: value }))} placeholder="1ขห 9832" autoFocus />
            <Field label="ชื่อ-นามสกุลลูกค้า" value={form.customerName} onChange={(value) => setForm((cur) => ({ ...cur, customerName: value }))} placeholder="วิชาญชัย พรหมโท" />
            <Field label="ส่วนลด" value={form.discount} onChange={(value) => setForm((cur) => ({ ...cur, discount: value.replace(/\D/g, "") }))} placeholder="10000" inputMode="numeric" />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">ช่องทางชำระเงิน</span>
              <div className="grid grid-cols-2 gap-2">
                {(["finance", "cash"] as RealtimePaymentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((cur) => ({ ...cur, paymentType: type }))}
                    className={`min-h-12 rounded-lg border px-3 text-sm font-bold ${
                      form.paymentType === type
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-line bg-[#0b0d11] text-soft"
                    }`}
                  >
                    {type === "finance" ? "ไฟแนนซ์" : "เงินสด"}
                  </button>
                ))}
              </div>
            </label>
            <Field label="เซลส์เจ้าของเคส" value={form.saleName} onChange={(value) => setForm((cur) => ({ ...cur, saleName: value }))} />
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-base font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Clock3 size={20} />}
              เข้าคิวรอราคา RT
            </button>
          </form>
        </SectionCard>

        <SectionCard title="สถานะคิว realtime" icon={<Activity size={18} />}>
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-cyan-100">ระบบรอเมลราคา RT อัตโนมัติ</p>
                <p className="mt-1 text-xs leading-5 text-cyan-100/75">
                  เมลใหม่เข้าแล้วระบบจะ Match ราคาให้เอง ปุ่ม Sync ถูกซ่อนไว้สำหรับแอดมิน/กรณีฉุกเฉิน
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs font-black text-cyan-100">
                AUTO MODE
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/5 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">กลุ่ม LINE แจ้งผล</span>
                <select
                  value={lineTargetId}
                  onChange={(event) => setLineTargetId(event.target.value)}
                  className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-cyan-300"
                >
                  <option value="">เลือกกลุ่ม LINE</option>
                  {lineGroups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {group.name || group.groupId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-bold text-white sm:mt-6">
                <input
                  type="checkbox"
                  checked={autoSendLine}
                  onChange={(event) => setAutoSendLine(event.target.checked)}
                  className="h-5 w-5 accent-cyan-300"
                />
                ส่ง LINE อัตโนมัติเมื่อ Match
              </label>
            </div>
            {!lineGroups.length && (
              <p className="mt-2 text-xs text-amber-100">
                ยังไม่พบกลุ่ม LINE จากระบบ ตั้งค่าที่หน้า LINE ก่อน หรือเชิญ LINE OA เข้ากลุ่มแล้วส่งข้อความในกลุ่มหนึ่งครั้ง
              </p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3">
              <Search size={20} className="text-cyan-300" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นเลขท้ายทะเบียน / ลูกค้า / เซลส์"
                className="h-12 min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-[#6f7785]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterSummaryPill>เมลล่าสุด {time(dashboard?.lastSyncAt)}</FilterSummaryPill>
            <FilterSummaryPill>Parse {dashboard?.latestMail?.durationMs ?? 0} ms</FilterSummaryPill>
            <FilterSummaryPill>Duplicate {dashboard?.duplicated || 0}</FilterSummaryPill>
            <FilterSummaryPill>ยกเลิก {dashboard?.cancelled || 0}</FilterSummaryPill>
          </div>

          <details className="rounded-lg border border-line bg-[#0b0d11] p-3">
            <summary className="cursor-pointer text-sm font-bold text-soft">เครื่องมือแอดมิน / ทดสอบระบบ</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={simulateMailSync}
                disabled={syncing}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 font-bold text-cyan-100"
              >
                {syncing ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                จำลองเมลราคา
              </button>
              <button
                type="button"
                onClick={syncRealGmail}
                disabled={gmailSyncing}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-4 font-bold text-brand"
              >
                {gmailSyncing ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                Sync Gmail เอง
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-soft">
              ใช้เฉพาะตอนทดสอบหรือกรณี Gmail Push ไม่มา หน้าใช้งานจริงให้รอระบบอัตโนมัติ
            </p>
          </details>

          <div className="space-y-2">
            {filteredQueue.length ? (
              filteredQueue.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onCopy={() => copyText(item.bookingText)}
                  onBooked={() => markBooked(item)}
                  onCancel={() => cancelQueue(item)}
                  onSendLine={() => sendLine(item)}
                  sendingLine={sendingLineId === item.id}
                />
              ))
            ) : (
              <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
                ยังไม่มี Waiting Queue
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="ประวัติเมลราคา" icon={<Mail size={18} />}>
          {(dashboard?.mailLogs || []).length ? (
            dashboard?.mailLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-line bg-[#0b0d11] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-white">{log.subject}</p>
                  <span className="rounded-full border border-cyan-300/40 px-2 py-1 text-xs font-bold text-cyan-100">{log.status}</span>
                </div>
                <p className="mt-1 text-soft">{log.sender} / {time(log.receivedAt)}</p>
                <p className="mt-2 text-[#dbe7f3]">รถ {log.vehicleCount} คัน / match {log.matchedCount} คิว / {log.durationMs} ms</p>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-line bg-[#0b0d11] p-4 text-soft">ยังไม่มี log เมล</p>
          )}
        </SectionCard>

        <SectionCard title="โหมดความเร็ว" icon={<ShieldCheck size={18} />}>
          <ul className="space-y-2 text-sm text-[#dbe7f3]">
            <li>หลัก: Gmail Push/Webhook เมื่อเมลใหม่เข้า ระบบ Match ทันที</li>
            <li>สำรอง: ปุ่ม Sync Gmail เองถูกซ่อนไว้ในเครื่องมือแอดมิน</li>
            <li>กันพลาด: ราคา RT เก่ากว่าเวลาที่กดคิวจะไม่ถูกนำมา Match</li>
            <li>ส่งต่อ: เปิด “ส่ง LINE อัตโนมัติเมื่อ Match” เพื่อไม่ต้องกดเอง</li>
          </ul>
        </SectionCard>
      </section>
    </PageContainer>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
        {icon}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-soft">{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-cyan-300"
      />
    </label>
  );
}

function QueueCard({
  item,
  onCopy,
  onBooked,
  onCancel,
  onSendLine,
  sendingLine
}: {
  item: QueueItem;
  onCopy: () => void;
  onBooked: () => void;
  onCancel: () => void;
  onSendLine: () => void;
  sendingLine: boolean;
}) {
  const statusStyle =
    item.status === "MATCHED"
      ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
      : item.status === "BOOKED"
        ? "border-green-300/40 bg-green-300/10 text-green-100"
        : item.status === "CANCELLED"
          ? "border-red-300/40 bg-red-300/10 text-red-100"
        : item.status === "DUPLICATED"
          ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
          : "border-line bg-[#121720] text-soft";

  return (
    <article className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-black text-white">{item.plate}</p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusStyle}`}>{item.status}</span>
            <span className="rounded-full border border-line px-2.5 py-1 text-xs text-soft">#{item.waitingOrder}</span>
          </div>
          <p className="mt-1 text-sm text-soft">{item.customerName} / {item.saleName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-soft">RT</p>
          <p className="text-lg font-black text-cyan-200">{money(item.rtPrice)}</p>
        </div>
      </div>

      {item.note && <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-sm text-amber-100">{item.note}</p>}
      {item.lineStatus && item.lineStatus !== "not_sent" && (
        <p
          className={`mt-2 rounded-lg border p-2 text-sm ${
            item.lineStatus === "sent"
              ? "border-green-300/30 bg-green-300/10 text-green-100"
              : "border-red-300/30 bg-red-300/10 text-red-100"
          }`}
        >
          LINE: {item.lineStatus === "sent" ? `ส่งแล้ว ${time(item.lineSentAt)}` : item.lineError || "ส่งไม่สำเร็จ"}
        </p>
      )}

      {item.bookingText && (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-black/30 p-3 text-sm leading-6 text-[#e8eef7]">
          {item.bookingText}
        </pre>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={onCopy}
          disabled={!item.bookingText}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 font-bold text-white disabled:opacity-40"
        >
          <Copy size={18} />
          Copy
        </button>
        <button
          type="button"
          onClick={onSendLine}
          disabled={!item.bookingText || sendingLine}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 font-bold text-cyan-100 disabled:opacity-40"
        >
          {sendingLine ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          LINE
        </button>
        <button
          type="button"
          onClick={onBooked}
          disabled={item.status !== "MATCHED"}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 font-black text-slate-950 disabled:opacity-40"
        >
          <CheckCircle2 size={18} />
          Lock Booked
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={item.status === "BOOKED" || item.status === "CANCELLED"}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300/35 bg-red-300/10 px-3 font-bold text-red-100 disabled:opacity-40"
        >
          <XCircle size={18} />
          Cancel
        </button>
      </div>
    </article>
  );
}
