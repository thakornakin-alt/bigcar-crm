"use client";

import { FormEvent, ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, Phone, UserPlus } from "lucide-react";
import { PageContainer, SectionCard } from "@/app/components/ui";

type AuthMode = "login" | "register";

const inputClass = "min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-soft/60";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(endpoint: string, payload: Record<string, FormDataEntryValue>) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(payload)))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      setMessage("เข้าสู่ระบบโปรไฟล์เซลล์เรียบร้อย");
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit("/api/auth/login", {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || "")
    });
  }

  function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit("/api/auth/register", {
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      nickname: String(form.get("nickname") || ""),
      phone: String(form.get("phone") || ""),
      lineId: String(form.get("lineId") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      position: String(form.get("position") || "Sales"),
      branch: String(form.get("branch") || "")
    });
  }

  return (
    <PageContainer>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-white">โปรไฟล์เซลล์</h1>
        <p className="mt-2 text-sm leading-6 text-soft">
          Login/Register ใช้เพื่อจำข้อมูลเซลล์ของตัวเองเท่านั้น ระบบเดิมยังเข้าใช้ได้ตามปกติ ไม่บังคับล็อกอิน
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel p-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`min-h-11 rounded-lg px-4 text-sm font-black ${mode === "login" ? "bg-brand text-ink" : "text-soft"}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`min-h-11 rounded-lg px-4 text-sm font-black ${mode === "register" ? "bg-brand text-ink" : "text-soft"}`}
        >
          Register
        </button>
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-300/30 bg-red-400/10 text-red-100" : "border-brand/30 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <SectionCard title={mode === "login" ? "Login" : "Register"} icon={mode === "login" ? <LockKeyhole size={18} /> : <UserPlus size={18} />}>
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="grid gap-3">
              <TextInput name="email" label="Email" type="email" icon={<Mail size={18} className="text-brand" />} placeholder="big@example.com" />
              <TextInput name="password" label="Password" type="password" icon={<LockKeyhole size={18} className="text-brand" />} placeholder="••••••••" />
              <button disabled={loading} className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-60">
                {loading ? "กำลังเข้า..." : "เข้าใช้โปรไฟล์นี้"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput name="firstName" label="ชื่อจริง" required />
                <TextInput name="lastName" label="นามสกุล" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput name="nickname" label="ชื่อเล่น" required />
                <TextInput name="phone" label="เบอร์โทร" type="tel" inputMode="tel" autoComplete="tel" required />
              </div>
              <TextInput name="lineId" label="LINE ID" placeholder="@bigcars" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput name="position" label="ตำแหน่ง" placeholder="Sales" />
                <TextInput name="branch" label="สาขา" required placeholder="สาขาบางนา" />
              </div>
              <TextInput name="email" label="Email" type="email" required icon={<Mail size={18} className="text-brand" />} />
              <TextInput name="password" label="Password" type="password" required icon={<LockKeyhole size={18} className="text-brand" />} />
              <button disabled={loading} className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-60">
                {loading ? "กำลังสมัคร..." : "สมัครและใช้โปรไฟล์นี้"}
              </button>
            </form>
          )}
        </SectionCard>

        <SectionCard title="ใช้งานแบบเบา" icon={<Phone size={18} />}>
          <p className="text-sm leading-6 text-soft">
            ข้อมูลนี้จะถูกใช้เติมชื่อ เบอร์ LINE สาขา และโปรไฟล์เซลล์ใน CRM v2 ก่อน ยังไม่ล็อกระบบเดิม และยังไม่เปลี่ยน flow รายงาน/สต็อกเดิม
          </p>
          <div className="grid gap-2 text-sm text-soft">
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เก็บใน Google Sheet แยกชื่อ SalesUsers</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">Logout ได้จากหน้าโปรไฟล์</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ถ้าไม่ Login ระบบจะใช้ข้อมูล default เดิม</span>
          </div>
          <Link href="/crm" className="flex min-h-12 items-center justify-center rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white">
            กลับ CRM v2
          </Link>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function TextInput({
  name,
  label,
  type = "text",
  placeholder,
  icon,
  required,
  inputMode,
  autoComplete
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon?: ReactNode;
  required?: boolean;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">{label}</span>
      <div className="mt-2 flex min-h-12 items-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-white">
        {icon}
        <input name={name} type={type} inputMode={inputMode} autoComplete={autoComplete} required={required} className={inputClass} placeholder={placeholder || label} />
      </div>
    </label>
  );
}
