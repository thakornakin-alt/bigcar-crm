"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";

const generic = "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      setMessage(data.message || generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06080b] px-4 py-6 text-white sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-md content-center">
        <div className="rounded-[28px] border border-white/10 bg-panel/90 p-5 shadow-glow sm:p-7">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand/12 text-brand"><ShieldCheck /></div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand">BIG CAR CRM</p>
            <h1 className="mt-2 text-2xl font-black">ลืมรหัสผ่าน</h1>
            <p className="mt-2 text-sm leading-6 text-soft">กรอกอีเมลที่ลงทะเบียนไว้ เพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
          </div>
          {message ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-4 text-sm font-bold leading-6 text-white">{message}</div>
              <Link href="/" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-black"><ArrowLeft size={18} />กลับไปเข้าสู่ระบบ</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-black">Email</span>
                <span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-line bg-[#0b0d11] px-3 text-brand focus-within:border-brand">
                  <Mail size={18} /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" />
                </span>
              </label>
              <button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-black text-ink disabled:opacity-60">
                {loading && <Loader2 size={18} className="animate-spin" />}{loading ? "กำลังส่งคำขอ..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
              </button>
              <Link href="/" className="flex min-h-11 items-center justify-center gap-2 text-sm font-black text-soft"><ArrowLeft size={17} />กลับไปเข้าสู่ระบบ</Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
