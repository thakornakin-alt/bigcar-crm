"use client";

import { forwardRef, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import { safeReturnTo } from "@/lib/safe-return-to";

const loginAnnouncementSeenKey = "bigcar-login-announcement-v1-seen";

type LoginState = {
  email: string;
  password: string;
  remember: boolean;
};

const blankLogin: LoginState = {
  email: "",
  password: "",
  remember: true
};

export default function LoginHomePage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<LoginState>(blankLogin);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.user) router.replace("/dashboard");
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, [router]);

  useEffect(() => {
    try {
      setAnnouncementOpen(window.localStorage.getItem(loginAnnouncementSeenKey) !== "1");
    } catch {
      setAnnouncementOpen(true);
    }
  }, []);

  function closeAnnouncement() {
    try {
      window.localStorage.setItem(loginAnnouncementSeenKey, "1");
    } catch {
      // Keep the Login page usable when browser storage is unavailable.
    }
    setAnnouncementOpen(false);
  }

  function openRegistration() {
    closeAnnouncement();
    router.push("/auth");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.push(safeReturnTo(returnTo));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#06080b] px-4 py-6 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_36%),linear-gradient(135deg,_rgba(255,255,255,0.07),_transparent_28%)]" />
      <section className="relative mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-5xl content-center">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="hidden lg:block">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-7 shadow-[0_28px_120px_rgba(0,0,0,0.45)]">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-brand">BIG CAR CRM</p>
              <h1 className="mt-5 text-5xl font-black leading-tight tracking-normal">Workspace สำหรับทีมขายรถ</h1>
              <p className="mt-5 text-base leading-8 text-soft">
                จัดการลูกค้า งานรถ ปฏิทิน รายงาน และโปรไฟล์เซลล์ในหน้าตาเดียวที่ใช้งานเร็วบนมือถือ
              </p>
              <div className="mt-8 grid gap-3">
                {["Soft Auth ไม่ล็อกระบบเดิม", "เตรียม ownerId / workspaceId", "รองรับ Multi-user ต่อในอนาคต"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-line bg-black/25 px-4 py-3 text-sm font-bold text-white">
                    <CheckCircle2 size={18} className="text-brand" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md rounded-[28px] border border-white/10 bg-panel/90 p-5 shadow-glow backdrop-blur sm:p-7">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/35 bg-brand/12 text-brand shadow-glow">
                <ShieldCheck size={30} />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-brand">BIG CAR CRM</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-white">เข้าสู่ระบบ</h1>
              <p className="mt-2 text-sm leading-6 text-soft">CRM สำหรับงานลูกค้า งานรถ และทีมขาย</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={login} className="space-y-4">
              <LoginField
                ref={emailRef}
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                icon={<Mail size={18} />}
                placeholder="big@example.com"
              />
              <LoginField
                label="Password"
                type="password"
                value={form.password}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                icon={<LockKeyhole size={18} />}
                placeholder="••••••••"
              />

              <div className="flex justify-end">
                <Link href="/forgot-password" className="min-h-10 px-1 py-2 text-sm font-black text-brand hover:underline">
                  ลืมรหัสผ่าน?
                </Link>
              </div>

              <label className="flex min-h-10 items-center gap-3 text-sm font-bold text-soft">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))}
                  className="h-4 w-4 accent-brand"
                />
                Remember me
              </label>

              <button
                type="submit"
                disabled={loading || checkingSession}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-base font-black text-ink transition active:scale-[0.99] disabled:opacity-60"
              >
                {loading || checkingSession ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                {checkingSession ? "กำลังตรวจ session..." : loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>

            <div className="mt-5 border-t border-line pt-4">
              <Link
                href="/auth"
                className="mb-2 flex min-h-11 items-center justify-center rounded-xl border border-brand/35 bg-brand/10 px-4 text-sm font-black text-brand transition hover:border-brand"
              >
                สมัครบัญชีใหม่
              </Link>
            </div>
          </div>
        </div>
      </section>

      {announcementOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-announcement-title"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-[22px] border border-brand/30 bg-[#0d1014] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.65)] sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
            <button
              type="button"
              onClick={closeAnnouncement}
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-soft transition hover:border-brand/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="ปิดประกาศ"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <div className="relative pr-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
                <UserPlus size={24} aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-brand">BIG CAR CRM</p>
              <h2 id="login-announcement-title" className="mt-2 text-2xl font-black leading-tight text-white">
                ลงทะเบียนบัญชีผู้ใช้งาน
              </h2>
              <p className="mt-3 text-sm leading-7 text-soft">
                หากคุณยังไม่มีบัญชี BIG CAR CRM สามารถลงทะเบียนบัญชีของตนเองเพื่อเข้าสู่ระบบและเริ่มใช้งานได้
              </p>
            </div>

            <div className="relative mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={closeAnnouncement}
                className="min-h-12 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-black text-white transition hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                ไว้ทีหลัง
              </button>
              <button
                type="button"
                onClick={openRegistration}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-ink transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1014]"
              >
                <UserPlus size={18} aria-hidden="true" />
                ลงทะเบียนบัญชี
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const LoginField = forwardRef<HTMLInputElement, {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  placeholder: string;
}>(function LoginField({
  label,
  type,
  value,
  onChange,
  icon,
  placeholder
}, ref) {
  return (
    <label className="block">
      <span className="text-sm font-black text-white">{label}</span>
      <span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-line bg-[#0b0d11] px-3 text-brand focus-within:border-brand">
        {icon}
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#6f7785]"
        />
      </span>
    </label>
  );
});
