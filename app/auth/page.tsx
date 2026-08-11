"use client";

import { FormEvent, ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, Phone, UserPlus } from "lucide-react";
import { PageContainer, SectionCard } from "@/app/components/ui";
import { useSalesProfile } from "@/lib/use-sales-profile";

type AuthMode = "login" | "register";

const inputClass = "min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-soft/60";

export default function AuthPage() {
  const router = useRouter();
  const { user } = useSalesProfile();
  const canRegister = user?.role === "admin" || user?.role === "super_admin";
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(endpoint: string, payload: Record<string, unknown>, redirect = true) {
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
      setMessage(String(data.warning || (redirect ? "เข้าสู่ระบบเรียบร้อย" : "สร้างบัญชี Sales สำเร็จ")));
      if (redirect) {
        router.push("/profile");
        router.refresh();
      }
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

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("confirmPassword") || "")) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    const avatarFile = form.get("avatar");
    const avatar = avatarFile instanceof File && avatarFile.size ? {
      name: avatarFile.name,
      type: avatarFile.type,
      size: avatarFile.size,
      base64: await fileToBase64(avatarFile)
    } : undefined;
    submit("/api/auth/register", {
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      nickname: String(form.get("nickname") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      password,
      avatar
    }, false);
  }

  return (
    <PageContainer>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-white">เข้าสู่ระบบ BIG CAR CRM</h1>
        <p className="mt-2 text-sm leading-6 text-soft">
          ใช้บัญชีพนักงานสำหรับเข้าถึงระบบภายใน ผู้ดูแลระบบสามารถสร้างบัญชี Sales ใหม่จากหน้านี้
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
        {canRegister ? <button
          type="button"
          onClick={() => setMode("register")}
          className={`min-h-11 rounded-lg px-4 text-sm font-black ${mode === "register" ? "bg-brand text-ink" : "text-soft"}`}
        >
          Register
        </button> : <span className="flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-soft">Admin สร้างผู้ใช้ใหม่</span>}
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-300/30 bg-red-400/10 text-red-100" : "border-brand/30 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <SectionCard title={mode === "login" ? "Login" : "Register"} icon={mode === "login" ? <LockKeyhole size={18} /> : <UserPlus size={18} />}>
          {mode === "login" || !canRegister ? (
            <form onSubmit={handleLogin} className="grid gap-3">
              <TextInput name="email" label="Email" type="email" icon={<Mail size={18} className="text-brand" />} placeholder="big@example.com" />
              <TextInput name="password" label="Password" type="password" icon={<LockKeyhole size={18} className="text-brand" />} placeholder="••••••••" />
              <button disabled={loading} className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-60">
                {loading ? "กำลังเข้า..." : "เข้าใช้โปรไฟล์นี้"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="grid gap-3">
              <label className="rounded-lg border border-dashed border-line bg-[#0b0d11] p-3 text-sm font-bold text-white">
                รูปโปรไฟล์ <span className="font-normal text-soft">(ไม่บังคับ · JPG/PNG/WebP ไม่เกิน 4MB)</span>
                <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm text-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:font-bold file:text-ink" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput name="firstName" label="ชื่อจริง" required />
                <TextInput name="lastName" label="นามสกุล" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput name="nickname" label="ชื่อเล่น" required />
                <TextInput name="phone" label="เบอร์โทร" type="tel" inputMode="tel" autoComplete="tel" required />
              </div>
              <TextInput name="email" label="Email" type="email" required icon={<Mail size={18} className="text-brand" />} />
              <TextInput name="password" label="Password" type="password" required icon={<LockKeyhole size={18} className="text-brand" />} />
              <TextInput name="confirmPassword" label="ยืนยันรหัสผ่าน" type="password" required icon={<LockKeyhole size={18} className="text-brand" />} />
              <button disabled={loading} className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-60">
                {loading ? "กำลังสมัคร..." : "สมัครและใช้โปรไฟล์นี้"}
              </button>
            </form>
          )}
        </SectionCard>

        <SectionCard title="ข้อมูลบัญชี" icon={<Phone size={18} />}>
          <p className="text-sm leading-6 text-soft">
            โปรไฟล์นี้ใช้ชื่อ เบอร์โทร LINE สาขา และรูปประจำตัวร่วมกันใน CRM โดยไม่เปลี่ยนกฎธุรกิจของโมดูลเดิม
          </p>
          <div className="grid gap-2 text-sm text-soft">
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เก็บใน Google Sheet แยกชื่อ SalesUsers</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">Logout ได้จากหน้าโปรไฟล์</span>
            <span className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">Role และสิทธิ์จัดการโดย Admin เท่านั้น</span>
          </div>
          <Link href="/crm" className="flex min-h-12 items-center justify-center rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white">
            กลับ CRM v2
          </Link>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
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
