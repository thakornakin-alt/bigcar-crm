import { BadgeCheck, LineChart, Phone, UserRound } from "lucide-react";
import { CrmShell } from "@/app/components/crm-shell";
import { SectionCard } from "@/app/components/ui";
import { demoCurrentUser, fullName, roleLabels } from "@/lib/crm-core";

export default function ProfilePage() {
  const user = demoCurrentUser;

  return (
    <CrmShell user={user} title="โปรไฟล์เซลล์" subtitle="ข้อมูลนี้จะถูกใช้กับค่างวด Export รูป รายงานจอง รายงานขาย และ Email Signature ใน Phase ถัดไป">
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ข้อมูลเซลล์" icon={<UserRound size={18} />}>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-3xl font-black text-ink">
              {user.nickname.slice(0, 1)}
            </div>
            <div>
              <p className="text-xl font-black text-white">{fullName(user)}</p>
              <p className="mt-1 text-sm text-soft">{user.nickname} · {roleLabels[user.role]}</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-soft">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เบอร์: <b className="text-white">{user.phone}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">LINE ID: <b className="text-white">{user.lineId}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">สาขา: <b className="text-white">{user.branch}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ตำแหน่ง: <b className="text-white">{user.position}</b></p>
          </div>
        </SectionCard>

        <SectionCard title="ระบบรูปโปรไฟล์" icon={<BadgeCheck size={18} />}>
          <div className="rounded-lg border border-dashed border-line bg-[#0b0d11] px-4 py-8 text-center">
            <UserRound className="mx-auto text-brand" size={34} />
            <p className="mt-3 font-bold text-white">Avatar Uploader</p>
            <p className="mt-1 text-sm leading-6 text-soft">Phase ถัดไปจะรองรับอัปโหลดครั้งเดียว ลบพื้นหลัง Resize Optimize และ cache รูปไว้ใช้กับทุก template</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft"><Phone size={16} className="mb-2 text-brand" /> ใช้ข้อมูลเซลล์อัตโนมัติทุกหน้า</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft"><LineChart size={16} className="mb-2 text-brand" /> เก็บ Activity Log การ export/แก้ไข</p>
          </div>
        </SectionCard>
      </div>
    </CrmShell>
  );
}
