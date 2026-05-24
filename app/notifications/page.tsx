"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Car, FileText, Loader2, Wrench } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { CrmNotification } from "@/lib/notifications";

const filters = [
  { label: "ทั้งหมด", value: "all" },
  { label: "งานวันนี้", value: "today" },
  { label: "เตรียมรถ", value: "prep" },
  { label: "Stock Match", value: "stock_match" }
];

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function iconFor(category: CrmNotification["category"]) {
  if (category === "stock_match") return Car;
  if (category === "prep") return Wrench;
  if (category === "finance") return FileText;
  return CalendarDays;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleNotifications = useMemo(() => {
    return filter === "all" ? notifications : notifications.filter((item) => item.category === filter);
  }, [filter, notifications]);

  async function loadNotifications() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ notifications: CrmNotification[] }>("/api/notifications");
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดแจ้งเตือนไม่สำเร็จ");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <PageContainer wide>
      <PageTitle
        title="แจ้งเตือน"
        subtitle="รวมงานสำคัญจากปฏิทิน รอส่งมอบ และ Stock Match"
        actions={
          <TopMenuButton href="/" icon={<Bell size={18} />} variant="primary">
            Dashboard
          </TopMenuButton>
        }
      />

      {error && <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ตัวกรอง" icon={<Bell size={18} />}>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <FilterChip key={item.value} active={filter === item.value} onClick={() => setFilter(item.value)}>
                {item.label}
              </FilterChip>
            ))}
          </div>
          <button type="button" onClick={loadNotifications} className="min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm font-black text-white">
            Refresh
          </button>
        </SectionCard>

        <SectionCard title={`งานสำคัญ ${visibleNotifications.length.toLocaleString("th-TH")} รายการ`} icon={<CalendarDays size={18} />}>
          {loading ? (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-soft">
              <Loader2 size={22} className="mr-2 animate-spin text-brand" />
              Loading
            </div>
          ) : visibleNotifications.length ? (
            <div className="grid gap-3">
              {visibleNotifications.map((item) => {
                const Icon = iconFor(item.category);
                return (
                  <a key={item.id} href={item.href} className="block rounded-lg border border-line bg-[#0b0d11] p-3 transition hover:border-brand/60">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                        <Icon size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-white">{item.title}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${item.priority === "important" ? "border-brand/30 text-brand" : "border-line text-soft"}`}>
                            {item.priority === "important" ? "สำคัญ" : "ติดตาม"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-soft">
                          {item.plate} · {item.customerName} · {item.owner}
                        </p>
                        <p className="mt-1 text-xs text-soft">{item.detail}</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
              ยังไม่มีแจ้งเตือนสำคัญ
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
