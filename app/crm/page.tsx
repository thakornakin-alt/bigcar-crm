"use client";

import Link from "next/link";
import { Calculator, Car, FileImage, FileText, Plus, UsersRound } from "lucide-react";
import { CrmShell, MetricCard } from "@/app/components/crm-shell";
import { SectionCard, TopMenuButton } from "@/app/components/ui";
import { demoCurrentUser, roleLabels } from "@/lib/crm-core";
import { useSalesProfile } from "@/lib/use-sales-profile";

const quickActions = [
  { href: "/", label: "ลูกค้าเดิม", icon: <UsersRound size={18} /> },
  { href: "/stock-export", label: "สร้างรูปสต็อก", icon: <FileImage size={18} /> },
  { href: "/calculator", label: "ค่างวด", icon: <Calculator size={18} /> },
  { href: "/booking-reports", label: "รายงานจอง", icon: <FileText size={18} /> }
];

export default function CrmPage() {
  const { user: salesProfile, loading } = useSalesProfile();
  const user = salesProfile || demoCurrentUser;

  return (
    <CrmShell
      user={user}
      title="CRM สำหรับเซลล์"
      subtitle={salesProfile ? "กำลังใช้โปรไฟล์เซลล์ที่ Login อยู่ ระบบเดิมยังใช้งานได้ตามปกติ" : "ยังไม่ได้ Login ระบบจะใช้ข้อมูล default เดิมก่อน"}
      actions={<Link href="/auth" className="rounded-lg border border-line bg-panel px-4 py-3 text-sm font-bold text-white">{salesProfile ? "สลับผู้ใช้" : "Login / Register"}</Link>}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="โปรไฟล์" value={loading ? "..." : user.nickname} hint={salesProfile ? user.email : "default profile"} />
          <MetricCard label="รถพร้อมขาย" value="-" hint="อ่านจาก StockInventory เดิม" icon={<Car size={18} className="text-brand" />} />
          <MetricCard label="Export วันนี้" value="-" hint="เตรียมต่อ activity log" icon={<FileImage size={18} className="text-brand" />} />
          <MetricCard label="สิทธิ์" value={roleLabels[user.role]} hint="ยังไม่บังคับสิทธิ์กับหน้าเดิม" />
        </div>

        <SectionCard title="งานที่ใช้บ่อย" icon={<Plus size={18} />}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <TopMenuButton key={action.href} href={action.href} icon={action.icon}>
                {action.label}
              </TopMenuButton>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="โปรไฟล์ส่วนตัว">
          <div className="grid gap-2 text-sm text-soft sm:grid-cols-2">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">ชื่อ: <b className="text-white">{user.firstName} {user.lastName}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">เบอร์: <b className="text-white">{user.phone}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">LINE: <b className="text-white">{user.lineId || "-"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">สาขา: <b className="text-white">{user.branch}</b></p>
          </div>
        </SectionCard>
      </div>
    </CrmShell>
  );
}
