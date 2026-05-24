"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, LineChart, LogOut, Phone, UserRound } from "lucide-react";
import { CrmShell } from "@/app/components/crm-shell";
import { SectionCard } from "@/app/components/ui";
import { demoCurrentUser, fullName, roleLabels } from "@/lib/crm-core";
import { useSalesProfile } from "@/lib/use-sales-profile";

export default function ProfilePage() {
  const router = useRouter();
  const { user: salesProfile, loading, setUser } = useSalesProfile();
  const user = salesProfile || demoCurrentUser;
  const isAdmin = user.role === "super_admin" || user.role === "admin";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <CrmShell
      user={user}
      title="โปรไฟล์เซลล์"
      subtitle="ข้อมูลนี้ใช้เป็นโปรไฟล์ส่วนตัวของเซลล์ โดยไม่บังคับล็อกอินกับระบบเดิม"
      actions={
        salesProfile ? (
          <button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-4 text-sm font-bold text-white">
            <LogOut size={16} className="text-brand" />
            Logout
          </button>
        ) : null
      }
    >
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ข้อมูลเซลล์" icon={<UserRound size={18} />}>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-3xl font-black text-ink">
              {user.nickname.slice(0, 1) || "U"}
            </div>
            <div>
              <p className="text-xl font-black text-white">{fullName(user)}</p>
              <p className="mt-1 text-sm text-soft">{user.nickname} · {roleLabels[user.role]}</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-soft">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">สถานะ: <b className="text-white">{loading ? "กำลังโหลด..." : salesProfile ? "Login แล้ว" : "ใช้ default profile"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">Email: <b className="text-white">{user.email}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เบอร์: <b className="text-white">{user.phone}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">LINE ID: <b className="text-white">{user.lineId || "-"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">สาขา: <b className="text-white">{user.branch}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ตำแหน่ง: <b className="text-white">{user.position}</b></p>
          </div>
        </SectionCard>

        <SectionCard title="ระบบรูปโปรไฟล์" icon={<BadgeCheck size={18} />}>
          <div className="rounded-lg border border-dashed border-line bg-[#0b0d11] px-4 py-8 text-center">
            <UserRound className="mx-auto text-brand" size={34} />
            <p className="mt-3 font-bold text-white">Avatar Uploader</p>
            <p className="mt-1 text-sm leading-6 text-soft">ตอนนี้เปิด Register/Login จริงก่อน ส่วนอัปโหลดรูปเซลล์จะต่อแบบแยก storage ภายหลัง</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft"><Phone size={16} className="mb-2 text-brand" /> ใช้ข้อมูลเซลล์อัตโนมัติใน CRM v2</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft"><LineChart size={16} className="mb-2 text-brand" /> ระบบเดิมยังไม่ถูกบังคับล็อกอิน</p>
          </div>
          {isAdmin && (
            <Link href="/admin/users" className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink">
              จัดการผู้ใช้
            </Link>
          )}
        </SectionCard>
      </div>
    </CrmShell>
  );
}
