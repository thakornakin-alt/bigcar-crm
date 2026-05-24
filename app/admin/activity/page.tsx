"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import { roleLabels } from "@/lib/crm-core";
import { useSalesProfile } from "@/lib/use-sales-profile";
import type { ActivityLog } from "@/lib/types";

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const actionLabels: Record<string, string> = {
  "auth.register": "Register",
  "auth.login": "Login",
  "auth.logout": "Logout",
  "customer.create": "เพิ่มลูกค้า",
  "customer.update": "แก้ลูกค้า",
  "customer.delete": "ลบลูกค้า",
  "profile.update": "แก้โปรไฟล์",
  "profile.avatar.upload": "อัปโหลดรูปโปรไฟล์",
  "profile.lineQr.upload": "อัปโหลด QR LINE",
  "line.sendText": "ส่งข้อความ LINE",
  "line.sendReport": "ส่งรายงาน/รูปเข้า LINE"
};

export default function AdminActivityPage() {
  const { user, loading } = useSalesProfile();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState("");
  const canView = user?.role === "super_admin" || user?.role === "admin";

  useEffect(() => {
    if (loading || !canView) {
      setLoadingLogs(false);
      return;
    }
    loadLogs();
  }, [loading, canView]);

  async function loadLogs() {
    setLoadingLogs(true);
    setError("");
    try {
      const data = await api<{ logs: ActivityLog[] }>("/api/activity/logs?limit=150");
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลด Activity Log ไม่สำเร็จ");
    } finally {
      setLoadingLogs(false);
    }
  }

  if (!loading && !canView) {
    return (
      <PageContainer>
        <PageTitle
          title="ไม่มีสิทธิ์เข้าถึง"
          subtitle="Activity Log สำหรับ Admin และ Super Admin เท่านั้น"
          actions={<TopMenuButton href="/settings" icon={<ArrowLeft size={18} />}>กลับ</TopMenuButton>}
        />
        <SectionCard title="Restricted" icon={<ShieldAlert size={18} />}>
          <p className="text-sm leading-6 text-soft">เมนูนี้ถูกซ่อนไว้สำหรับดูประวัติหลังบ้าน ไม่แสดงให้เซลล์ทั่วไปใช้งานครับ</p>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="Activity Log"
        subtitle={user ? `ผู้ดูแล: ${user.nickname} · ${roleLabels[user.role]}` : "ประวัติการใช้งานหลังบ้าน"}
        actions={
          <>
            <TopMenuButton href="/settings" icon={<ArrowLeft size={18} />}>
              กลับ
            </TopMenuButton>
            <button
              type="button"
              onClick={loadLogs}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-bold text-white"
            >
              <RefreshCw size={16} className="text-brand" />
              Refresh
            </button>
          </>
        }
      />

      {error && <div className="mb-4 rounded-lg border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">{error}</div>}

      <SectionCard title="ประวัติล่าสุด" icon={loadingLogs ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}>
        {loading || loadingLogs ? (
          <div className="flex min-h-32 items-center justify-center text-soft">
            <Loader2 size={22} className="mr-2 animate-spin text-brand" />
            Loading
          </div>
        ) : logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-soft">
                  <th className="px-3 py-3 font-bold">เวลา</th>
                  <th className="px-3 py-3 font-bold">ผู้ใช้</th>
                  <th className="px-3 py-3 font-bold">Action</th>
                  <th className="px-3 py-3 font-bold">Target</th>
                  <th className="px-3 py-3 font-bold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={`${log.at}-${log.action}-${index}`} className="border-b border-line/70">
                    <td className="whitespace-nowrap px-3 py-3 text-soft">{log.at}</td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-white">{log.userName || "System/Guest"}</p>
                      <p className="mt-0.5 text-xs text-soft">{log.role || "-"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-soft">
                      {[log.targetType, log.targetId].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="max-w-[360px] px-3 py-3 text-soft">{log.detail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-[#0b0d11] px-4 py-8 text-center text-soft">
            ยังไม่มี Activity Log
          </div>
        )}
        <div className="flex justify-end">
          <Link href="/settings" className="text-sm font-bold text-brand">
            กลับไปตั้งค่าระบบ
          </Link>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
