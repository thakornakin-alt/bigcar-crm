import Link from "next/link";
import { LockKeyhole, Mail, Phone, UserPlus } from "lucide-react";
import { PageContainer, SectionCard } from "@/app/components/ui";

export default function AuthPage() {
  return (
    <PageContainer>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-white">เข้าสู่ระบบเซลล์</h1>
        <p className="mt-2 text-sm leading-6 text-soft">หน้า Preview สำหรับออกแบบระบบ Login/Register เท่านั้น ตอนนี้ยังไม่เปิดใช้งานจริงและยังไม่บังคับ Login กับระบบเดิม</p>
      </header>

      <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
        Register / Forgot Password ยังไม่เชื่อมระบบจริง เพื่อไม่ให้กระทบงานที่ใช้อยู่ ทางเข้าหน้านี้ถูกย้ายไปไว้ใน ตั้งค่า &gt; ระบบทดลอง CRM v2
      </div>

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
            ดูตัวอย่าง CRM v2
          </Link>
          <button type="button" disabled className="min-h-11 rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-soft opacity-60">
            ลืมรหัสผ่าน (ยังไม่เปิด)
          </button>
        </SectionCard>

        <SectionCard title="Register" icon={<UserPlus size={18} />}>
          <p className="text-sm leading-6 text-soft">สมัครเซลล์ใหม่พร้อมข้อมูลโปรไฟล์ เบอร์ LINE สาขา และรูปเซลล์ จะต่อกับ Google Sheet แยกใน Phase ถัดไป</p>
          <div className="grid gap-2 text-sm text-soft">
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ชื่อจริง / นามสกุล / ชื่อเล่น</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เบอร์โทร / LINE ID / QR LINE</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ตำแหน่ง / สาขา / Role</span>
          </div>
          <button type="button" disabled className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-soft opacity-60">
            <Phone size={18} className="text-brand" />
            Register ยังไม่เปิดใช้งานจริง
          </button>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
