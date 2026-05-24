"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ImageUp, LineChart, Loader2, LogOut, Phone, QrCode, Save, UserRound } from "lucide-react";
import { CrmShell } from "@/app/components/crm-shell";
import { SectionCard } from "@/app/components/ui";
import { demoCurrentUser, fullName, roleLabels } from "@/lib/crm-core";
import { useSalesProfile } from "@/lib/use-sales-profile";

export default function ProfilePage() {
  const router = useRouter();
  const { user: salesProfile, loading, setUser } = useSalesProfile();
  const user = salesProfile || demoCurrentUser;
  const isAdmin = user.role === "super_admin" || user.role === "admin";
  const [form, setForm] = useState({
    phone: "",
    lineId: "",
    position: "",
    branch: ""
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"" | "avatar" | "lineQr">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      phone: user.phone || "",
      lineId: user.lineId || "",
      position: user.position || "",
      branch: user.branch || ""
    });
  }, [user.branch, user.lineId, user.phone, user.position]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salesProfile) {
      setError("กรุณา Login ก่อนแก้โปรไฟล์");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกโปรไฟล์ไม่สำเร็จ");
      setUser(data.user);
      setMessage("บันทึกโปรไฟล์แล้ว หน้าต่าง ๆ จะใช้ข้อมูลใหม่นี้ทันที");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function uploadProfileImage(kind: "avatar" | "lineQr", file: File | null) {
    if (!file) return;
    if (!salesProfile) {
      setError("กรุณา Login ก่อนอัปโหลดรูป");
      return;
    }

    setUploading(kind);
    setError("");
    setMessage("");
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch("/api/profile/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: file.name,
          type: file.type,
          size: file.size,
          base64
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "อัปโหลดรูปไม่สำเร็จ");
      setUser(data.user);
      setMessage(kind === "avatar" ? "อัปโหลดรูปโปรไฟล์แล้ว" : "อัปโหลด QR LINE แล้ว");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading("");
    }
  }

  return (
    <CrmShell
      user={user}
      title="โปรไฟล์เซลล์"
      subtitle="ข้อมูลนี้ใช้เป็นโปรไฟล์ส่วนตัวของเซลล์ โดยไม่บังคับล็อกอินกับระบบเดิม"
      actions={
        salesProfile ? (
          <button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-4 text-sm font-bold text-white">
            <LogOut size={16} className="text-brand" />
            Logout
          </button>
        ) : null
      }
    >
      {(message || error) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-300/30 bg-red-400/10 text-red-100" : "border-brand/30 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard title="ข้อมูลเซลล์" icon={<UserRound size={18} />}>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-20 shrink-0 items-center justify-center bg-center ring-1 ring-brand/30 ${
                user.avatarUrl ? "w-20 rounded-full bg-brand bg-cover" : "w-28 rounded-lg bg-white bg-contain bg-no-repeat"
              }`}
              style={{ backgroundImage: `url(${user.avatarUrl || "/logo-rdd.png"})` }}
              aria-label="รูปโปรไฟล์เซลล์"
            />
            <div>
              <p className="text-xl font-black text-white">{fullName(user)}</p>
              <p className="mt-1 text-sm text-soft">{user.nickname} · {roleLabels[user.role]}</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-soft">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">สถานะ: <b className="text-white">{loading ? "กำลังโหลด..." : salesProfile ? "Login แล้ว" : "ใช้ default profile"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">Email: <b className="text-white">{user.email}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">เบอร์: <b className="text-white">{user.phone}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">LINE ID: <b className="text-white">{user.lineId || "-"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">รูปโปรไฟล์: <b className="text-white">{user.avatarUrl ? "มีแล้ว" : "ยังไม่มี"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">QR LINE: <b className="text-white">{user.lineQrUrl ? "มีแล้ว" : "ยังไม่มี"}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">สาขา: <b className="text-white">{user.branch}</b></p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2">ตำแหน่ง: <b className="text-white">{user.position}</b></p>
          </div>
        </SectionCard>

        <SectionCard title="แก้โปรไฟล์ตัวเอง" icon={<BadgeCheck size={18} />}>
          <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
            <ProfileField label="เบอร์โทร" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
            <ProfileField label="LINE ID" value={form.lineId} onChange={(value) => setForm((current) => ({ ...current, lineId: value }))} />
            <ProfileField label="ตำแหน่ง / ทีม" value={form.position} onChange={(value) => setForm((current) => ({ ...current, position: value }))} placeholder="Sales / ทีมพี่ลีฟ" />
            <ProfileField label="สาขา" value={form.branch} onChange={(value) => setForm((current) => ({ ...current, branch: value }))} placeholder="สาขาบางนา" />
            <button disabled={saving || !salesProfile} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-60 sm:col-span-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              บันทึกโปรไฟล์
            </button>
          </form>
          {!salesProfile && (
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
              ตอนนี้ยังใช้ default profile ถ้าต้องการแก้ข้อมูลส่วนตัวให้ Login ก่อน
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileImageUploader
              title="รูปโปรไฟล์เซลล์"
              description="ใช้ในรูปค่างวดและเอกสาร export"
              icon={<ImageUp size={18} />}
              imageUrl={user.avatarUrl}
              disabled={!salesProfile || Boolean(uploading)}
              loading={uploading === "avatar"}
              onSelect={(file) => uploadProfileImage("avatar", file)}
            />
            <ProfileImageUploader
              title="QR LINE"
              description="เก็บไว้ใช้กับ export/ลายเซ็นเซลล์"
              icon={<QrCode size={18} />}
              imageUrl={user.lineQrUrl}
              disabled={!salesProfile || Boolean(uploading)}
              loading={uploading === "lineQr"}
              onSelect={(file) => uploadProfileImage("lineQr", file)}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft"><Phone size={16} className="mb-2 text-brand" /> ใช้ข้อมูลเซลล์อัตโนมัติใน CRM v2</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft"><LineChart size={16} className="mb-2 text-brand" /> ระบบเดิมยังไม่ถูกบังคับล็อกอิน</p>
          </div>
          {isAdmin && (
            <Link href="/admin/users" className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 font-black text-ink">
              จัดการผู้ใช้
            </Link>
          )}
        </SectionCard>
      </div>
    </CrmShell>
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

function ProfileImageUploader({
  title,
  description,
  icon,
  imageUrl,
  disabled,
  loading,
  onSelect
}: {
  title: string;
  description: string;
  icon: ReactNode;
  imageUrl: string;
  disabled: boolean;
  loading: boolean;
  onSelect: (file: File | null) => void;
}) {
  return (
    <label className={`block rounded-lg border border-dashed border-line bg-[#0b0d11] p-4 ${disabled ? "opacity-70" : "cursor-pointer hover:border-brand/60"}`}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onSelect(event.target.files?.[0] || null)}
      />
      <div className="flex items-start gap-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-panel bg-cover bg-center text-brand"
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        >
          {!imageUrl ? icon : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-black text-white">
            {loading ? <Loader2 size={16} className="animate-spin text-brand" /> : null}
            {title}
          </p>
          <p className="mt-1 text-sm leading-5 text-soft">{description}</p>
          <p className="mt-2 text-xs font-bold text-brand">{imageUrl ? "แตะเพื่อเปลี่ยนรูป" : "แตะเพื่ออัปโหลด"}</p>
        </div>
      </div>
    </label>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || label}
        className="mt-2 h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-soft/60 focus:border-brand"
      />
    </label>
  );
}
