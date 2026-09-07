"use client";

import { FormEvent, ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LockKeyhole, Mail, Phone, User, UserPlus } from "lucide-react";

const inputClass = "h-12 min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-[#6f7785]";

export default function PublicRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("confirmPassword") || "")) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (password.length < 8) {
      setError("Password ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    const avatarFile = form.get("avatar");
    if (avatarFile instanceof File && avatarFile.size > 4 * 1024 * 1024) {
      setError("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 4MB");
      return;
    }

    setLoading(true);
    try {
      const avatar = avatarFile instanceof File && avatarFile.size ? {
        name: avatarFile.name,
        type: avatarFile.type,
        size: avatarFile.size,
        base64: await fileToBase64(avatarFile)
      } : undefined;
      const email = String(form.get("email") || "").trim().toLowerCase();
      const response = await fetch("/api/auth/self-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(form.get("firstName") || ""),
          lastName: String(form.get("lastName") || ""),
          nickname: String(form.get("nickname") || ""),
          phone: String(form.get("phone") || ""),
          email,
          password,
          avatar
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
      router.push(`/auth?registered=1&email=${encodeURIComponent(email)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07080a] px-4 py-6 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(214,182,108,0.14),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.045),_transparent_30%)]" />
      <section className="relative mx-auto w-full max-w-xl">
        <Link href="/auth" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-black text-soft hover:text-white">
          <ArrowLeft size={18} aria-hidden="true" /> กลับไป Login
        </Link>

        <div className="mt-3 w-full min-w-0 rounded-[22px] border border-white/10 bg-[#0d1014]/95 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.55)] sm:p-7">
          <header className="mb-6">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
              <UserPlus size={25} aria-hidden="true" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-brand">BIG CAR CRM</p>
            <h1 className="mt-2 text-3xl font-black text-white">สมัครสมาชิก</h1>
            <p className="mt-2 text-sm leading-6 text-soft">สร้างบัญชี Sales และกลับไปเข้าสู่ระบบได้ทันที</p>
          </header>

          {error ? <div role="alert" className="mb-4 rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div> : null}

          <form onSubmit={handleSubmit} className="grid min-w-0 gap-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <RegisterField name="firstName" label="ชื่อจริง" icon={<User size={18} />} autoComplete="given-name" required />
              <RegisterField name="lastName" label="นามสกุล" icon={<User size={18} />} autoComplete="family-name" required />
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <RegisterField name="nickname" label="ชื่อเล่น" icon={<User size={18} />} required />
              <RegisterField name="phone" label="เบอร์โทร" type="tel" inputMode="tel" icon={<Phone size={18} />} autoComplete="tel" required />
            </div>
            <RegisterField name="email" label="Email" type="email" inputMode="email" icon={<Mail size={18} />} autoComplete="email" required />
            <RegisterField name="password" label="Password" type="password" icon={<LockKeyhole size={18} />} autoComplete="new-password" minLength={8} required />
            <RegisterField name="confirmPassword" label="ยืนยัน Password" type="password" icon={<LockKeyhole size={18} />} autoComplete="new-password" minLength={8} required />

            <label className="min-w-0 rounded-xl border border-dashed border-white/12 bg-white/[0.035] p-3 text-sm font-bold text-white">
              รูปโปรไฟล์ <span className="font-normal text-soft">(ไม่บังคับ · JPG/PNG/WebP ไม่เกิน 4MB)</span>
              <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full min-w-0 text-sm text-soft file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:font-black file:text-ink" />
            </label>

            <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-black text-ink transition active:scale-[0.99] disabled:opacity-60">
              {loading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <UserPlus size={20} aria-hidden="true" />}
              {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function RegisterField({ name, label, type = "text", icon, inputMode, autoComplete, minLength, required }: {
  name: string;
  label: string;
  type?: string;
  icon: ReactNode;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-white">{label}</span>
      <span className="mt-2 flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-line bg-[#0b0d11] px-3 text-brand focus-within:border-brand">
        {icon}
        <input name={name} type={type} inputMode={inputMode} autoComplete={autoComplete} minLength={minLength} required={required} className={inputClass} placeholder={label} />
      </span>
    </label>
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
