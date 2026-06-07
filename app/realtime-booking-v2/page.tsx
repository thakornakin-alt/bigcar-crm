"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readRealtimeBookingV2LineGroupId, writeRealtimeBookingV2LineGroupId } from "@/lib/realtime-booking-v2-settings";
import { formatRealtimeBookingV2LineText } from "@/lib/realtime-booking-v2-format";

type QueueItem = {
  id: string;
  plate: string;
  customerName: string;
  saleName: string;
  paymentType: "cash" | "finance";
  discount: number;
  remark?: string;
  status: "WAITING" | "MATCHED" | "BOOKED" | "CANCELLED";
  createdAt: string;
  matchedAt?: string;
  bookedAt?: string;
  lineStatus?: "not_sent" | "sent" | "failed";
  lineSentAt?: string;
  lineError?: string;
  lineTargetId?: string;
  matchReason?: string;
  stockFound?: boolean;
  stockSource?: string;
  pricePlate?: string;
  priceReceivedAt?: string;
  priceSourceType?: "RT";
  ttlValid?: boolean;
  bookingConfirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  autoSendAttemptedAt?: string;
  autoSendStatus?: "pending" | "sent" | "failed";
  autoSendError?: string;
};

type Dashboard = {
  queue: QueueItem[];
  waiting: number;
  matched: number;
  booked: number;
  prices: Array<{ plate: string; normalizedPlate: string; receivedAt: string; rtPrice: number; sourceType?: "RT"; mailSubject?: string; sheetName?: string }>;
  lastUpdatedAt: string;
  ttlMinutes: number;
};

type LineGroup = {
  groupId: string;
  type: string;
  name: string;
  lastSeenAt: string;
  isDefault?: boolean;
};

function resolveV2LineGroupId(groups: LineGroup[], savedGroupId: string) {
  const savedGroup = groups.find((group) => group.groupId === savedGroupId);
  if (savedGroup?.groupId) return savedGroup.groupId;

  const defaultGroup = groups.find((group) => group.isDefault);
  if (defaultGroup?.groupId) return defaultGroup.groupId;

  if (groups.length === 1) return groups[0]?.groupId || "";

  return groups[0]?.groupId || "";
}

type V2LineDraft = {
  paymentType: "finance" | "cash";
  salesName: string;
  remark: string;
  discount: string;
};

type UiToggleStore = Record<string, boolean>;

function createDraftFromQueueItem(item: QueueItem): V2LineDraft {
  return {
    paymentType: item.paymentType || "finance",
    salesName: item.saleName || "บิ๊ก",
    remark: item.remark || "",
    discount: String(item.discount || 0)
  };
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6">{children}</main>;
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#101720,#06090e)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand">Big Car CRM</p>
      <h1 className="mt-2 text-2xl font-black tracking-normal text-white sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm font-medium text-soft">{subtitle}</p> : null}
    </header>
  );
}

function Card({
  title,
  children
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,32,0.92),rgba(7,10,15,0.94))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      {title ? <h2 className="mb-3 text-lg font-black text-white">{title}</h2> : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }
) {
  const { variant = "primary", className, ...rest } = props;
  const variantClass =
    variant === "primary"
      ? "border-brand bg-brand text-ink"
      : variant === "danger"
        ? "border-red-400/45 bg-red-950/30 text-red-100"
        : variant === "ghost"
          ? "border-white/10 bg-white/[0.04] text-soft"
          : "border-white/10 bg-[#0b0d11] text-white";

  return (
    <button
      type="button"
      {...rest}
      className={classNames(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition hover:border-brand/70 disabled:cursor-not-allowed disabled:opacity-50",
        variantClass,
        className
      )}
    />
  );
}

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
  if (!value && value !== 0) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function moneyOrDash(value?: number) {
  if (!value && value !== 0) return "—";
  if (value === 0) return "—";
  return money(value);
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

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function loadToggleStore(key: string): UiToggleStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "boolean")) as UiToggleStore;
  } catch {
    return {};
  }
}

function saveToggleStore(key: string, value: UiToggleStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatLastSync(value?: string | null) {
  if (!value) return "ยังไม่เคย Sync Gmail";
  return `Sync ล่าสุด: ${new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value))}`;
}

function statusLabel(status: QueueItem["status"], lineStatus?: QueueItem["lineStatus"], bookingConfirmedAt?: string) {
  if (status === "WAITING") return "🟡 รอราคา";
  if (status === "MATCHED") return "🟢 พร้อมส่งจอง";
  if (status === "BOOKED" && lineStatus === "sent" && !bookingConfirmedAt) return "🔵 ส่งจองแล้ว";
  return "⚪ ยกเลิกแล้ว";
}

function statusTone(status: QueueItem["status"], lineStatus?: QueueItem["lineStatus"], bookingConfirmedAt?: string) {
  if (status === "WAITING") return "text-amber-200";
  if (status === "MATCHED") return "text-emerald-200";
  if (status === "BOOKED" && lineStatus === "sent" && !bookingConfirmedAt) return "text-sky-200";
  return "text-white/70";
}

function DeveloperToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-black text-soft shadow-sm backdrop-blur-sm"
    >
      ⚙️ ข้อมูลเทคนิค
    </button>
  );
}

export default function RealtimeBookingV2Page() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [lineDrafts, setLineDrafts] = useState<Record<string, V2LineDraft>>({});
  const [debugOpen, setDebugOpen] = useState<Record<string, boolean>>({});
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [plate, setPlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [price, setPrice] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [paymentType, setPaymentType] = useState<"finance" | "cash">("finance");
  const [salesName, setSalesName] = useState("บิ๊ก");
  const [remark, setRemark] = useState("");
  const [selectedLineGroupId, setSelectedLineGroupId] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const autoSendPendingRef = useRef<Set<string>>(new Set());
  const isDev = process.env.NODE_ENV !== "production";
  const debugStoreKey = "bigcar-realtime-booking-v2-debug";
  const detailsStoreKey = "bigcar-realtime-booking-v2-details";

  async function load() {
    const data = await api<Dashboard>("/api/realtime-booking-v2");
    setDashboard(data);
    return data;
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDebugOpen(loadToggleStore(debugStoreKey));
    setDetailsOpen(loadToggleStore(detailsStoreKey));
  }, []);

  function toggleDebug(itemId: string) {
    setDebugOpen((current) => {
      const next = { ...current, [itemId]: !current[itemId] };
      saveToggleStore(debugStoreKey, next);
      return next;
    });
  }

  function toggleDetails(itemId: string) {
    setDetailsOpen((current) => {
      const next = { ...current, [itemId]: !current[itemId] };
      saveToggleStore(detailsStoreKey, next);
      return next;
    });
  }

  useEffect(() => {
    let mounted = true;
    async function loadLineGroups() {
      try {
        const response = await fetch("/api/line/groups", {
          cache: "no-store",
          headers: { "Content-Type": "application/json" }
        });
        const data = (await response.json()) as { groups?: LineGroup[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load LINE groups");
        if (!mounted) return;
        const groups = Array.isArray(data.groups) ? data.groups : [];
        setLineGroups(groups);
        const saved = readRealtimeBookingV2LineGroupId();
        setSelectedLineGroupId(resolveV2LineGroupId(groups, saved));
      } catch {
        if (!mounted) return;
        setLineGroups([]);
        setSelectedLineGroupId("");
      }
    }

    void loadLineGroups();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedLineGroupId) {
      writeRealtimeBookingV2LineGroupId(selectedLineGroupId);
    }
  }, [selectedLineGroupId]);

  const visibleQueue = useMemo(
    () =>
      (dashboard?.queue || []).filter((item) => {
        if (item.status === "CANCELLED") return false;
        if (item.status === "BOOKED" && item.bookingConfirmedAt) return false;
        return true;
      }),
    [dashboard]
  );

  const summaryCounts = useMemo(
    () => ({
      waiting: visibleQueue.filter((item) => item.status === "WAITING").length,
      readyToSend: visibleQueue.filter((item) => item.status === "MATCHED").length,
      sent: visibleQueue.filter((item) => item.status === "BOOKED" && item.lineStatus === "sent" && !item.bookingConfirmedAt).length
    }),
    [visibleQueue]
  );

  const selectedLineGroup = useMemo(
    () => lineGroups.find((group) => group.groupId === selectedLineGroupId) || null,
    [lineGroups, selectedLineGroupId]
  );

  const selectedLineTargetId = selectedLineGroup?.groupId || "";

  const priceByPlate = useMemo(() => {
    const map = new Map<string, NonNullable<Dashboard["prices"]>[number]>();
    for (const priceRow of dashboard?.prices || []) {
      const key = normalizePlate(priceRow.plate);
      if (!map.has(key)) map.set(key, priceRow);
    }
    return map;
  }, [dashboard]);

  useEffect(() => {
    setLineDrafts((current) => {
      const next = { ...current };
      for (const item of dashboard?.queue || []) {
        if (!next[item.id]) {
          next[item.id] = createDraftFromQueueItem(item);
        }
      }
      return next;
    });
  }, [dashboard]);

  const canSendLine = useCallback(
    (item: QueueItem) =>
      item.status === "MATCHED" &&
      (item.lineStatus === "not_sent" || item.lineStatus === "failed" || !item.lineStatus) &&
      Boolean(selectedLineTargetId),
    [selectedLineTargetId]
  );

  const canAutoSendLine = useCallback(
    (item: QueueItem) =>
      item.status === "MATCHED" &&
      (item.lineStatus === "not_sent" || !item.lineStatus) &&
      Boolean(selectedLineTargetId) &&
      Boolean(item.plate) &&
      Boolean(lineTextForItem(item)) &&
      !item.autoSendAttemptedAt &&
      item.autoSendStatus !== "sent",
    [selectedLineTargetId, lineDrafts]
  );

  useEffect(() => {
    const candidates = (visibleQueue || []).filter((item) => canAutoSendLine(item));
    if (!candidates.length) return;

    let cancelled = false;
    async function run() {
      for (const item of candidates) {
        if (cancelled) return;
        if (autoSendPendingRef.current.has(item.id)) continue;
        autoSendPendingRef.current.add(item.id);
        try {
          await api("/api/realtime-booking-v2/send-line", {
            method: "POST",
            body: JSON.stringify({
              id: item.id,
              targetId: selectedLineTargetId,
              paymentType: lineDrafts[item.id]?.paymentType || item.paymentType || "finance",
              saleName: lineDrafts[item.id]?.salesName || item.saleName || "บิ๊ก",
              remark: lineDrafts[item.id]?.remark ?? item.remark ?? "",
              discount: Number(lineDrafts[item.id]?.discount ?? item.discount ?? 0) || 0,
              autoSend: true
            })
          });
          setMessage("ส่ง LINE อัตโนมัติสำเร็จ");
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : "ส่ง LINE อัตโนมัติไม่สำเร็จ");
          await load();
        } finally {
          autoSendPendingRef.current.delete(item.id);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [visibleQueue, selectedLineTargetId, lineDrafts]);

  const lineTextForItem = (item: QueueItem) => {
    const draft = lineDrafts[item.id];
    return formatRealtimeBookingV2LineText({
      ...item,
      paymentType: draft?.paymentType || item.paymentType || "finance",
      saleName: draft?.salesName || item.saleName || "บิ๊ก",
      remark: draft?.remark ?? item.remark ?? "",
      discount: Number(draft?.discount ?? item.discount ?? 0) || 0
    });
  };

  function updateDraft(itemId: string, patch: Partial<V2LineDraft>) {
    setLineDrafts((current) => ({
      ...current,
      [itemId]: {
        ...createDraftFromQueueItem((dashboard?.queue || []).find((item) => item.id === itemId) || ({
          id: itemId,
          plate: "",
          customerName: "",
          saleName: "บิ๊ก",
          paymentType: "finance",
          discount: 0,
          status: "WAITING",
          createdAt: ""
        } as QueueItem)),
        ...(current[itemId] || {}),
        ...patch
      }
    }));
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/realtime-booking-v2", {
        method: "POST",
        body: JSON.stringify({
          plate,
          customerName,
          paymentType,
          saleName: salesName,
          remark,
          discount: Number(discount) > 0 ? Number(discount) : 0
        })
      });
      setMessage("สร้างคิวแล้ว");
      setPlate("");
      setCustomerName("");
      setRemark("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างคิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onSyncGmail() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{
        checked: number;
        processed?: unknown[];
        skipped?: Array<{ reason?: string }>;
        skippedSenderCount?: number;
        skippedDelayCount?: number;
        attachmentsFound?: number;
        parsedRows?: number;
        ingestedPrices?: number;
        matchedCount?: number;
        query?: string;
      }>("/api/realtime-booking-v2/gmail-sync", {
        method: "POST",
        body: JSON.stringify({})
      });
      setMessage(
        `Sync Gmail: query=${result.query || "n/a"} · checked=${result.checked} · processed=${result.processed?.length || 0} · skipped=${result.skipped?.length || 0} · skippedSenderCount=${result.skippedSenderCount || 0} · skippedDelayCount=${result.skippedDelayCount || 0} · attachmentsFound=${result.attachmentsFound || 0} · parsedRows=${result.parsedRows || 0} · ingestedPrices=${result.ingestedPrices || 0} · matchedCount=${result.matchedCount || 0}`
      );
      setLastSyncAt(new Date().toISOString());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync Gmail ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onSimulatePrice() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ matchedCount: number; matchedItem: QueueItem | null }>("/api/realtime-booking-v2/simulate-price", {
        method: "POST",
        body: JSON.stringify({ plate, rtPrice: Number(price) })
      });
      setMessage(result.matchedCount ? "MATCHED" : "ยังไม่ MATCHED");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "จำลองราคาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onSimulatePriceIgnoreTtl() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ matchedCount: number; matchedItem: QueueItem | null }>("/api/realtime-booking-v2/simulate-price", {
        method: "POST",
        body: JSON.stringify({
          plate,
          rtPrice: Number(price),
          ignoreTtl: true
        })
      });
      setMessage(result.matchedCount ? "MATCHED (dev ignore TTL)" : "ยังไม่ MATCHED");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "จำลองราคาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onSendLine(item: QueueItem) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!selectedLineGroup?.groupId) {
        throw new Error("กรุณาตั้งค่ากลุ่ม LINE ก่อนใช้งาน");
      }
      await api("/api/realtime-booking-v2/send-line", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          targetId: selectedLineTargetId,
          paymentType: lineDrafts[item.id]?.paymentType || item.paymentType || "finance",
          saleName: lineDrafts[item.id]?.salesName || item.saleName || "บิ๊ก",
          remark: lineDrafts[item.id]?.remark ?? item.remark ?? "",
          discount: Number(lineDrafts[item.id]?.discount ?? item.discount ?? 0) || 0
        })
      });
      setMessage("ส่ง LINE สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง LINE ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmBooked(item: QueueItem) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/realtime-booking-v2/confirm", {
        method: "POST",
        body: JSON.stringify({ id: item.id })
      });
      setMessage("ส่งจองสำเร็จแล้ว");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยันส่งจองไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onCancelQueue(item: QueueItem) {
    if (!window.confirm("ต้องการยกเลิกคิวนี้หรือไม่?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/realtime-booking-v2/cancel", {
        method: "POST",
        body: JSON.stringify({ id: item.id })
      });
      setMessage("ยกเลิกคิวแล้ว");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกคิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Header title="Realtime Booking" subtitle="สร้างคิว · รับราคา · ส่งจอง" />
      <div className="space-y-4 px-4 pb-24">
        <section className="sticky top-3 z-20 rounded-[28px] border border-white/10 bg-[rgba(9,12,17,0.92)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Realtime Booking</h2>
              <p className="mt-1 text-sm text-soft">สร้างคิว · รับราคา · ส่งจอง</p>
            </div>
            <Button type="button" disabled={busy} onClick={onSyncGmail} className="w-full min-w-28 sm:w-auto">
              Sync Gmail
            </Button>
          </div>
          <p className="mt-3 text-sm text-soft">{formatLastSync(lastSyncAt)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">🟡 รอราคา</div>
              <div className="mt-1 text-2xl font-black text-white">{summaryCounts.waiting}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">🟢 พร้อมส่งจอง</div>
              <div className="mt-1 text-2xl font-black text-white">{summaryCounts.readyToSend}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-200">🔵 ส่งแล้ว</div>
              <div className="mt-1 text-2xl font-black text-white">
                {summaryCounts.sent}
              </div>
            </div>
          </div>
        </section>

        {isDev && dashboard && (
          <Card title="Debug">
            <p className="mb-3 text-xs text-soft">Runtime / ttl {dashboard.ttlMinutes} นาที</p>
            <div className="grid gap-2 text-sm text-soft sm:grid-cols-2">
              <div>waiting: {dashboard.waiting}</div>
              <div>matched: {dashboard.matched}</div>
              <div>booked: {dashboard.booked}</div>
              <div>lastUpdatedAt: {time(dashboard.lastUpdatedAt)}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-soft">
              {dashboard.prices.length ? (
                <>
                  <div>latest price: {dashboard.prices[0]?.plate || "-"}</div>
                  <div>price source: {dashboard.prices[0]?.sourceType || "RT"}</div>
                </>
              ) : (
                <div>price source: RT</div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={onSimulatePrice}>จำลองราคา</Button>
              {isDev && (
                <Button type="button" variant="ghost" disabled={busy} onClick={onSimulatePriceIgnoreTtl}>
                  ทดสอบแบบไม่เช็ค TTL
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card title="สร้างคิว">
          <p className="mb-3 text-xs text-soft">กรอกทะเบียนและชื่อลูกค้า</p>
          <form onSubmit={onCreate} className="grid gap-3">
            <input className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white" placeholder="ทะเบียนรถ" value={plate} onChange={(e) => setPlate(e.target.value)} />
            <input className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white" placeholder="ชื่อลูกค้า" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">ช่องทางชำระเงิน</span>
                <select
                  className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white outline-none focus:border-brand"
                  value={paymentType}
                  onChange={(event) => setPaymentType(event.target.value === "cash" ? "cash" : "finance")}
                >
                  <option value="finance">ไฟแนนซ์</option>
                  <option value="cash">เงินสด</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">เซลส์เจ้าของเคส</span>
                <input
                  className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white"
                  placeholder="บิ๊ก"
                  value={salesName}
                  onChange={(event) => setSalesName(event.target.value)}
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">ส่วนลด</span>
              <input
                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white"
                placeholder="เช่น 10000"
                inputMode="numeric"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">หมายเหตุ/ส่วนลดเพิ่มเติม</span>
              <input
                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white"
                placeholder="เช่น (ส่วนลดส่วนกลาง 10,000)"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy} className="w-full py-4 text-base">
              สร้างคิว
            </Button>
          </form>
        </Card>

        <Card title="ส่ง LINE">
          <p className="mb-3 text-xs text-soft">ส่งเองเมื่อ MATCHED</p>
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">กลุ่ม LINE ที่ใช้ส่ง</span>
              <select
                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white outline-none focus:border-brand"
                value={selectedLineGroupId}
                onChange={(event) => setSelectedLineGroupId(event.target.value)}
              >
                {!lineGroups.length ? (
                  <option value="">ยังไม่พบกลุ่ม LINE</option>
                ) : (
                  <>
                    <option value="">กรุณาเลือกกลุ่ม LINE</option>
                    {lineGroups.map((group) => (
                      <option key={group.groupId} value={group.groupId}>
                        {group.name || "กลุ่ม LINE"}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
            <p className="text-xs text-soft">
              {selectedLineGroup ? `เลือกไว้: ${selectedLineGroup.name || "กลุ่ม LINE"} (จำบนเครื่องนี้)` : "กรุณาตั้งค่ากลุ่ม LINE ก่อนใช้งาน"}
            </p>
            <p className="text-xs text-soft">เมื่อแมทสำเร็จ ระบบจะส่ง LINE อัตโนมัติ</p>
            {!selectedLineGroup?.groupId && <p className="text-xs text-amber-200">ตั้งค่ากลุ่ม LINE ก่อน ระบบจึงจะส่งอัตโนมัติได้</p>}
          </div>
        </Card>

        {message && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{message}</div>}
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}

        <Card title="คิวหลัก">
          <p className="mb-3 text-xs text-soft">คิวที่ยังใช้งานอยู่</p>
          {!visibleQueue.length ? (
            <div className="py-8 text-center text-sm text-soft">
              <div>ยังไม่มีคิวรอราคา</div>
              <div className="mt-1">เมื่อมีการสร้างคิวใหม่ รายการจะปรากฏที่นี่</div>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleQueue.map((item) => {
                const isSendDoneCard = item.status === "BOOKED" && item.lineStatus === "sent" && !item.bookingConfirmedAt;
                const showPreview = item.status === "MATCHED" || isSendDoneCard;
                const showDetails = detailsOpen[item.id] ?? false;
                const priceRow = priceByPlate.get(normalizePlate(item.plate));
                const standardPrice = priceRow?.rtPrice || 0;
                const discountValue = Number(lineDrafts[item.id]?.discount ?? item.discount ?? 0) || 0;
                const sellingPrice = standardPrice > 0 ? standardPrice - discountValue : 0;
                return (
                  <article key={item.id} className="relative rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[1.7rem] font-black tracking-tight text-white sm:text-2xl">{item.plate}</div>
                        <div className="mt-1 text-base text-soft">{item.customerName}</div>
                        <div className={classNames("mt-2 text-sm font-black", statusTone(item.status, item.lineStatus, item.bookingConfirmedAt))}>
                          {statusLabel(item.status, item.lineStatus, item.bookingConfirmedAt)}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-soft">
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-3 py-2">
                          <span>ราคามาตรฐาน</span>
                          <span className="font-black text-white">{standardPrice > 0 ? money(standardPrice) : "ยังไม่มีราคา"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-3 py-2">
                          <span>ราคาตั้งขาย</span>
                          <span className="font-black text-white">{standardPrice > 0 ? moneyOrDash(sellingPrice) : "—"}</span>
                        </div>
                      </div>

                      {showPreview && showDetails && (
                        <div className="rounded-2xl border border-white/10 bg-[#0a0d11] p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-white">ข้อมูลสำหรับส่ง LINE</p>
                            <p className="text-xs text-soft">{item.lineStatus === "sent" ? "ส่ง LINE สำเร็จ" : "Preview ข้อความ LINE"}</p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-2">
                              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">ช่องทางชำระเงิน</span>
                              <select
                                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white outline-none focus:border-brand"
                                value={lineDrafts[item.id]?.paymentType || item.paymentType || "finance"}
                                onChange={(event) =>
                                  updateDraft(item.id, { paymentType: event.target.value === "cash" ? "cash" : "finance" })
                                }
                              >
                                <option value="finance">ไฟแนนซ์</option>
                                <option value="cash">เงินสด</option>
                              </select>
                            </label>
                            <label className="grid gap-2">
                              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">เซลส์เจ้าของเคส</span>
                              <input
                                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white"
                                value={lineDrafts[item.id]?.salesName || item.saleName || "บิ๊ก"}
                                onChange={(event) => updateDraft(item.id, { salesName: event.target.value })}
                                placeholder="บิ๊ก"
                              />
                            </label>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-2">
                              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">ส่วนลด</span>
                              <input
                                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white"
                                value={lineDrafts[item.id]?.discount || String(item.discount || 0)}
                                onChange={(event) => updateDraft(item.id, { discount: event.target.value })}
                                inputMode="numeric"
                                placeholder="0"
                              />
                            </label>
                            <label className="grid gap-2 sm:col-span-1">
                              <span className="text-xs font-black uppercase tracking-[0.18em] text-soft">หมายเหตุ/ส่วนลดเพิ่มเติม</span>
                              <input
                                className="rounded-2xl border border-white/10 bg-[#0a0d11] px-4 py-4 text-base text-white"
                                value={lineDrafts[item.id]?.remark || item.remark || ""}
                                onChange={(event) => updateDraft(item.id, { remark: event.target.value })}
                                placeholder="เช่น (ส่วนลดส่วนกลาง 10,000)"
                              />
                            </label>
                          </div>
                          <div className="mt-3 rounded-2xl border border-white/10 bg-[#090b0f] p-4">
                            <div className="mb-2 text-sm font-black text-white">Preview ข้อความ LINE</div>
                            <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-soft">{lineTextForItem(item)}</pre>
                          </div>
                        </div>
                      )}

                      {item.status === "BOOKED" && item.lineStatus === "sent" && !item.bookingConfirmedAt && (
                        <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 px-4 py-3 text-sm font-black text-sky-200">
                          ส่ง LINE สำเร็จ
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {item.status === "MATCHED" && (
                        <Button type="button" onClick={() => onSendLine(item)} disabled={busy || !canSendLine(item)} className="w-full sm:w-auto">
                          ส่ง LINE
                        </Button>
                      )}
                      {item.status === "MATCHED" && item.lineStatus === "failed" && (
                        <Button type="button" onClick={() => onSendLine(item)} disabled={busy || !canSendLine(item)} className="w-full sm:w-auto">
                          ส่ง LINE อีกครั้ง
                        </Button>
                      )}
                      {item.status === "BOOKED" && item.lineStatus === "sent" && !item.bookingConfirmedAt && (
                        <Button type="button" onClick={() => onConfirmBooked(item)} disabled={busy} className="w-full sm:w-auto">
                          ส่งจองสำเร็จ
                        </Button>
                      )}
                      {(item.status === "MATCHED" || item.status === "WAITING") && (
                        <Button type="button" variant="danger" onClick={() => onCancelQueue(item)} disabled={busy} className="w-full sm:w-auto">
                          ยกเลิกคิว
                        </Button>
                      )}
                      {item.status === "MATCHED" && !selectedLineGroup?.groupId && (
                        <div className="w-full text-xs text-amber-200">ยังไม่ได้ตั้งค่ากลุ่ม LINE</div>
                      )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleDetails(item.id)}
                          className="inline-flex items-center gap-2 text-xs font-black text-soft"
                        >
                          {showDetails ? "▲ ซ่อนข้อมูลการจอง" : "▼ ดูข้อมูลการจอง"}
                        </button>
                        <DeveloperToggle onClick={() => toggleDebug(item.id)} />
                      </div>
                    </div>

                    {debugOpen[item.id] && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-soft">
                        <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-soft">ข้อมูลเทคนิค</div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <div>normalizedPlate: {normalizePlate(item.plate) || "-"}</div>
                          <div>reason: {item.matchReason || "-"}</div>
                          <div>ttlValid: {String(item.ttlValid ?? false)}</div>
                          <div>sourceType: {item.priceSourceType || "RT"}</div>
                          <div>stockFound: {String(item.stockFound ?? false)}</div>
                          <div>lineStatus raw: {item.lineStatus || "-"}</div>
                          <div>mailSubject: {priceByPlate.get(normalizePlate(item.plate))?.mailSubject || "-"}</div>
                          <div>receivedAt: {item.priceReceivedAt || "-"}</div>
                        </div>
                      </div>
                    )}

                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
