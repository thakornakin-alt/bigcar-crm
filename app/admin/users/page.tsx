"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, RefreshCw, ShieldCheck, Unlock, Users } from "lucide-react";
import { FilterSummaryPill, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import { useSalesProfile } from "@/lib/use-sales-profile";
import type { SalesUser, SalesUserRole } from "@/lib/types";

const roleLabels: Record<SalesUserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  viewer: "Viewer"
};

const roles: SalesUserRole[] = ["super_admin", "admin", "sales", "viewer"];

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

export default function AdminUsersPage() {
  const { user: salesProfile } = useSalesProfile();
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin = salesProfile?.role === "super_admin" || salesProfile?.role === "admin";

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!term) return users;
    return users.filter((user) =>
      [user.email, user.firstName, user.lastName, user.nickname, user.phone, user.branch, user.role]
        .join("")
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes(term)
    );
  }, [query, users]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ users: SalesUser[] }>("/api/admin/users");
      setUsers(data.users);
      setMessage(`โหลดผู้ใช้ ${data.users.length.toLocaleString("th-TH")} คนแล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดผู้ใช้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateUser(user: SalesUser, patch: Partial<Pick<SalesUser, "role" | "locked" | "position" | "branch">>) {
    setSavingId(user.id);
    setError("");
    setMessage("");
    try {
      const data = await api<{ user: SalesUser }>("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id: user.id, ...patch })
      });
      setUsers((current) => current.map((item) => (item.id === data.user.id ? data.user : item)));
      setMessage(`อัปเดต ${data.user.nickname || data.user.email} แล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตผู้ใช้ไม่สำเร็จ");
    } finally {
      setSavingId("");
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="จัดการผู้ใช้"
        subtitle={salesProfile ? `Login เป็น ${salesProfile.nickname} · ${roleLabels[salesProfile.role]}` : "จัดการโปรไฟล์เซลล์ใน SalesUsers"}
        actions={
          <>
            <TopMenuButton href="/profile" icon={<Users size={18} />}>โปรไฟล์</TopMenuButton>
            <TopMenuButton href="/crm" icon={<ArrowLeft size={18} />}>CRM</TopMenuButton>
          </>
        }
      />

      {(message || error) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-300/30 bg-red-400/10 text-red-100" : "border-brand/30 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      {!salesProfile ? (
        <SectionCard title="ต้อง Login ก่อน" icon={<ShieldCheck size={18} />}>
          <p className="text-sm leading-6 text-soft">หน้านี้ใช้สำหรับ Admin จัดการโปรไฟล์เซลล์ กรุณา Login ด้วยบัญชี Super Admin หรือ Admin ก่อน</p>
          <Link href="/auth" className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink">ไป Login</Link>
        </SectionCard>
      ) : !isAdmin ? (
        <SectionCard title="ไม่มีสิทธิ์เข้าถึง" icon={<Lock size={18} />}>
          <p className="text-sm leading-6 text-soft">บัญชีนี้เป็น {roleLabels[salesProfile.role]} จึงยังจัดการผู้ใช้ไม่ได้ ให้ Super Admin เปลี่ยนสิทธิ์เป็น Admin ก่อน</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          <SectionCard title="ค้นหา User" icon={<Users size={18} />}>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นชื่อ / email / เบอร์ / สาขา / role"
                className="h-12 rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
              />
              <button type="button" onClick={loadUsers} disabled={loading} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterSummaryPill>ทั้งหมด {users.length.toLocaleString("th-TH")} คน</FilterSummaryPill>
              <FilterSummaryPill>แสดง {filteredUsers.length.toLocaleString("th-TH")} คน</FilterSummaryPill>
              <FilterSummaryPill>ล็อก {users.filter((user) => user.locked).length.toLocaleString("th-TH")} คน</FilterSummaryPill>
            </div>
          </SectionCard>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((user) => (
              <article key={user.id} className="rounded-lg border border-line bg-panel p-4 shadow-glow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-white">{user.nickname || user.firstName}</p>
                    <p className="mt-1 truncate text-sm text-soft">{user.firstName} {user.lastName}</p>
                    <p className="mt-1 truncate text-xs text-soft">{user.email}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${user.locked ? "border-red-300/35 bg-red-300/10 text-red-100" : "border-brand/35 bg-brand/10 text-brand"}`}>
                    {user.locked ? "Locked" : "Active"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-soft">
                  <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เบอร์: <span className="text-white">{user.phone || "-"}</span></p>
                  <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">สาขา: <span className="text-white">{user.branch || "-"}</span></p>
                  <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ตำแหน่ง: <span className="text-white">{user.position || "-"}</span></p>
                </div>

                <div className="mt-3 grid gap-2">
                  <label>
                    <span className="mb-1.5 block text-sm font-bold text-white">Role</span>
                    <select
                      value={user.role}
                      disabled={savingId === user.id}
                      onChange={(event) => updateUser(user, { role: event.target.value as SalesUserRole })}
                      className="h-11 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
                    >
                      {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={savingId === user.id || user.id === salesProfile.id}
                    onClick={() => updateUser(user, { locked: !user.locked })}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 font-bold disabled:opacity-45 ${
                      user.locked ? "border-brand/40 bg-brand/10 text-brand" : "border-red-300/35 bg-red-300/10 text-red-100"
                    }`}
                  >
                    {user.locked ? <Unlock size={18} /> : <Lock size={18} />}
                    {user.locked ? "Unlock" : "Lock"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </PageContainer>
  );
}
