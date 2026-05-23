import Link from "next/link";
import { LockKeyhole, Mail, Phone, UserPlus } from "lucide-react";
import { PageContainer, SectionCard } from "@/app/components/ui";

export default function AuthPage() {
  return (
    <PageContainer>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-white">เข้าสู่ระบบเซลล์</h1>
        <p className="mt-2 text-sm leading-6 text-soft">Phase 1 เป็นหน้า Auth ใหม่แบบแยกระบบเดิม ยังไม่บังคับ login กับหน้าเก่า</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <SectionCard title="Login" icon={<LockKeyhole size={18} />}>
          <label className="block">
            <span className="text-sm font-bold text-white">Email</span>
            <div className="mt-2 flex min-h-12 items-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-white">
              <Mail size={18} className="text-brand" />
              <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="big@example.com" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-white">Password</span>
            <div className="mt-2 flex min-h-12 items-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-white">
              <LockKeyhole size={18} className="text-brand" />
              <input type="password" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="••••••••" />
            </div>
          </label>
          <Link href="/crm" className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink">
            เข้า CRM
          </Link>
          <button type="button" className="min-h-11 rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white">
            ลืมรหัสผ่าน
          </button>
        </SectionCard>

        <SectionCard title="Register" icon={<UserPlus size={18} />}>
          <p className="text-sm leading-6 text-soft">สมัครเซลล์ใหม่พร้อมข้อมูลโปรไฟล์ เบอร์ LINE สาขา และรูปเซลล์ จะต่อกับ Google Sheet แยกใน Phase ถัดไป</p>
          <div className="grid gap-2 text-sm text-soft">
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ชื่อจริง / นามสกุล / ชื่อเล่น</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เบอร์โทร / LINE ID / QR LINE</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ตำแหน่ง / สาขา / Role</span>
          </div>
          <button type="button" className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white">
            <Phone size={18} className="text-brand" />
            ขอเปิดบัญชีผู้ใช้
          </button>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
