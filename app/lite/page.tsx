"use client";

import Link from "next/link";
import { Calculator, Car, CheckSquare } from "lucide-react";

const tools = [
  { href: "/stock-export", title: "Stock", subtitle: "ค้นหา กรอง และ Export สต็อก", icon: Car },
  { href: "/calculator", title: "คำนวณค่างวด", subtitle: "ใช้สูตรและตารางดอกเบี้ยจากระบบปัจจุบัน", icon: Calculator },
  { href: "/approval-forms", title: "อนุมัติ", subtitle: "ค้นหาทะเบียนและสร้างข้อความอนุมัติ", icon: CheckSquare }
];

export default function LiteHomePage() {
  return (
    <main className="crm-page mx-auto min-h-screen w-full max-w-4xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">BIG CAR</p>
        <h1 className="mt-1 text-3xl font-black text-white">เครื่องมือขายรถ</h1>
        <p className="mt-2 text-sm text-soft">เวอร์ชันแยกสำหรับ Stock · ค่างวด · อนุมัติ</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        {tools.map(({ href, title, subtitle, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-brand/50">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand"><Icon size={22} /></span>
            <h2 className="mt-4 text-lg font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-soft">{subtitle}</p>
          </Link>
        ))}
      </section>
      <p className="mt-6 text-xs text-white/45">โครงทดสอบนี้ยังคงระบบผู้ใช้เดิมไว้ชั่วคราว และยังไม่ตัดสินใจเรื่อง Login/โปรไฟล์เซลส์</p>
    </main>
  );
}
