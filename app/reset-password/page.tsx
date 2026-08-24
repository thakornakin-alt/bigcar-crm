"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#06080b]" />}><ResetPasswordForm /></Suspense>;
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/auth/reset-password/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((response) => response.json()).then((data) => setValid(Boolean(data.valid))).catch(() => setValid(false)).finally(() => setChecking(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (password.length < 10) return setError("รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร");
    if (password !== confirm) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
      setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#06080b] px-4 py-6 text-white sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-md content-center">
        <div className="rounded-[28px] border border-white/10 bg-panel/90 p-5 shadow-glow sm:p-7">
          <p className="text-center text-xs font-black uppercase tracking-[0.3em] text-brand">BIG CAR CRM</p>
          <h1 className="mt-2 text-center text-2xl font-black">ตั้งรหัสผ่านใหม่</h1>
          {checking ? <div className="mt-8 flex items-center justify-center gap-2 text-soft"><Loader2 className="animate-spin" />กำลังตรวจสอบลิงก์...</div>
          : success ? <div className="mt-6 space-y-4 text-center"><CheckCircle2 className="mx-auto text-brand" size={42} /><p className="font-black">ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ</p><Link href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 font-black text-ink">เข้าสู่ระบบ</Link></div>
          : !valid ? <div className="mt-6 space-y-4"><div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-4 text-sm font-bold">ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้งานแล้ว</div><Link href="/forgot-password" className="flex min-h-12 items-center justify-center rounded-xl border border-brand/35 text-sm font-black text-brand">ขอลิงก์ใหม่</Link></div>
          : <form onSubmit={submit} className="mt-6 space-y-4">
              {error && <div className="rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div>}
              <PasswordField label="รหัสผ่านใหม่" value={password} onChange={setPassword} />
              <PasswordField label="ยืนยันรหัสผ่านใหม่" value={confirm} onChange={setConfirm} />
              <button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-black text-ink disabled:opacity-60">{loading && <Loader2 size={18} className="animate-spin" />}{loading ? "กำลังตั้งรหัสผ่าน..." : "ตั้งรหัสผ่านใหม่"}</button>
            </form>}
        </div>
      </section>
    </main>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-sm font-black">{label}</span><span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-line bg-[#0b0d11] px-3 text-brand focus-within:border-brand"><LockKeyhole size={18} /><input type="password" required minLength={10} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" /></span></label>;
}
