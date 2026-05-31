"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Database, Download, FlaskConical, History, Loader2, MessageCircle, Save, Settings, Shield, Upload, UserRound } from "lucide-react";
import { NativeAppHeader, NativeAppShell, NativeBadge, NativeButton, SectionCard, TopMenuButton } from "@/app/components/ui";
import {
  BigCarSystemSettings,
  defaultSystemSettings,
  readSystemSettings,
  writeSystemSettings
} from "@/lib/client-settings";
import { useSalesProfile } from "@/lib/use-sales-profile";
import type { LineGroup } from "@/lib/types";

type StorageStatus = {
  ok: boolean;
  info: {
    provider: string;
    dataDir?: string;
    table?: string;
  };
  checkedAt: string;
  previousCheckedAt?: string;
  error?: string;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function SettingsPage() {
  const { user } = useSalesProfile();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [settings, setSettings] = useState<BigCarSystemSettings>(defaultSystemSettings);
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [checkingStorage, setCheckingStorage] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setSettings(readSystemSettings());
    loadGroups().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (isAdmin) checkStorage().catch(() => undefined);
  }, [isAdmin]);

  async function loadGroups() {
    setLoadingGroups(true);
    try {
      const data = await api<{ groups: LineGroup[] }>("/api/line/groups");
      setGroups(data.groups);
    } finally {
      setLoadingGroups(false);
    }
  }

  async function checkStorage() {
    setCheckingStorage(true);
    try {
      const data = await api<StorageStatus>("/api/system/storage-status");
      setStorageStatus(data);
    } finally {
      setCheckingStorage(false);
    }
  }

  async function restoreBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      if (!isAdmin) throw new Error("ไม่มีสิทธิ์ Restore Backup");
      if (!restoreFile) throw new Error("กรุณาเลือกไฟล์ Backup JSON");
      if (!window.confirm("Restore Backup จะเขียนทับข้อมูล Calendar, Leads, Vehicle Prep และ Sales Profiles ที่อยู่ใน Storage ปัจจุบัน ต้องการทำต่อหรือไม่?")) return;

      setRestoring(true);
      const text = await restoreFile.text();
      const payload = JSON.parse(text);
      const data = await api<{ ok: true; restoredKeys: string[] }>("/api/system/restore", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMessage(`Restore สำเร็จ ${data.restoredKeys.length} ชุดข้อมูล`);
      setRestoreFile(null);
      await checkStorage().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore Backup ไม่สำเร็จ");
    } finally {
      setRestoring(false);
    }
  }

  function update(field: keyof BigCarSystemSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      writeSystemSettings(settings);
      setMessage("บันทึกตั้งค่าระบบแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกตั้งค่าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function addLineGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddingGroup(true);
    setError("");
    setMessage("");

    try {
      if (!newGroupId.trim() || !newGroupName.trim()) throw new Error("กรุณากรอก Group ID และชื่อกลุ่ม");
      const data = await api<{ group: LineGroup }>("/api/line/groups", {
        method: "POST",
        body: JSON.stringify({
          groupId: newGroupId.trim(),
          type: "group",
          name: newGroupName.trim(),
          lastSeenAt: new Date().toISOString()
        })
      });
      setGroups((current) => {
        const filtered = current.filter((group) => group.groupId !== data.group.groupId);
        return [data.group, ...filtered];
      });
      setNewGroupId("");
      setNewGroupName("");
      setMessage("เพิ่มกลุ่ม LINE แล้ว เลือกเป็นค่าเริ่มต้นได้ทันที");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มกลุ่ม LINE ไม่สำเร็จ");
    } finally {
      setAddingGroup(false);
    }
  }

  return (
    <NativeAppShell>
      <NativeAppHeader
        title="ตั้งค่าระบบ"
        subtitle="จัดการโปรไฟล์ ระบบ LINE และเครื่องมือสำหรับแอดมิน"
        actions={<NativeBadge tone={isAdmin ? "brand" : "muted"}>{isAdmin ? "Admin" : "Profile"}</NativeBadge>}
      />

      {(message || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{error || message}</span>
        </div>
      )}

      {isAdmin && (
        <div className="mb-4">
          <SectionCard title="สถานะฐานข้อมูล" icon={<Database size={18} />}>
            <div
              className={`rounded-2xl border px-4 py-3 ${
                storageStatus?.ok
                  ? "border-brand/40 bg-brand/10"
                  : "border-amber-300/40 bg-amber-950/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    {storageStatus?.info.provider === "supabase" ? "Supabase" : "Local JSON"}
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-xs ${
                      storageStatus?.ok ? "border-brand/40 text-brand" : "border-amber-300/40 text-amber-100"
                    }`}>
                      {storageStatus?.ok ? "พร้อมใช้งาน" : "ต้องตรวจสอบ"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-soft">
                    {storageStatus?.info.provider === "supabase"
                      ? `Table: ${storageStatus.info.table || "big_car_crm_store"}`
                      : `Path: ${storageStatus?.info.dataDir || ".data"}`}
                  </p>
                  {storageStatus?.error && <p className="mt-1 text-xs text-red-100">{storageStatus.error}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => checkStorage().catch((err) => setError(err.message))}
                  disabled={checkingStorage}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {checkingStorage ? <Loader2 size={16} className="animate-spin text-brand" /> : <Database size={16} className="text-brand" />}
                  ตรวจอีกครั้ง
                </button>
                <a
                  href="/api/system/export"
                  className="flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-brand px-3 text-sm font-black text-ink"
                >
                  <Download size={16} />
                  Backup JSON
                </a>
              </div>
              <form onSubmit={restoreBackup} className="mt-4 rounded-2xl border border-white/10 bg-[#080c12] p-3">
                <p className="text-sm font-black text-white">Restore Backup JSON</p>
                <p className="mt-1 text-xs leading-5 text-soft">
                  ใช้เฉพาะกรณีย้ายเครื่องหรือกู้ข้อมูล ระบบจะรับเฉพาะไฟล์ Backup ของ BIG CAR RDD CRM
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}
                    className="min-h-11 rounded-2xl border border-white/10 bg-[#0b0d11] px-3 py-2 text-sm font-bold text-white file:mr-3 file:rounded-xl file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-black file:text-ink"
                  />
                  <button
                    type="submit"
                    disabled={restoring || !restoreFile}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/40 px-3 text-sm font-black text-amber-100 disabled:opacity-50"
                  >
                    {restoring ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Restore
                  </button>
                </div>
              </form>
            </div>
          </SectionCard>
        </div>
      )}

      <div className="mb-4">
        <SectionCard title="ระบบทดลอง CRM v2" icon={<FlaskConical size={18} />}>
          <p className="text-sm leading-6 text-soft">
            เมนูนี้เป็นโครงระบบ Multi-user สำหรับพัฒนาต่อ ยังไม่บังคับ Login/Register และยังไม่กระทบระบบเดิม
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <TopMenuButton href="/crm" icon={<UserRound size={18} />}>
              CRM v2
            </TopMenuButton>
            <TopMenuButton href="/profile" icon={<UserRound size={18} />}>
              โปรไฟล์
            </TopMenuButton>
            <TopMenuButton href="/admin/crm" icon={<Shield size={18} />}>
              Admin CRM
            </TopMenuButton>
            {isAdmin && (
              <TopMenuButton href="/admin/activity" icon={<History size={18} />}>
                Activity Log
              </TopMenuButton>
            )}
            <TopMenuButton href="/auth" icon={<Shield size={18} />}>
              Auth Preview
            </TopMenuButton>
            <TopMenuButton href="/stock-import" icon={<Upload size={18} />}>
              อัปโหลดสต็อก
            </TopMenuButton>
            <TopMenuButton href="/report-history" icon={<History size={18} />}>
              ประวัติ
            </TopMenuButton>
            <TopMenuButton href="/line-settings" icon={<MessageCircle size={18} />}>
              LINE Status
            </TopMenuButton>
          </div>
        </SectionCard>
      </div>

      <form onSubmit={saveSettings} className="space-y-4">
        <SectionCard title="ค่าเริ่มต้นรายงาน" icon={<Settings size={18} />}>
          <Field label="ทีมเริ่มต้น" value={settings.defaultTeamName} onChange={(value) => update("defaultTeamName", value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="รายงานจอง To" value={settings.bookingEmailTo} onChange={(value) => update("bookingEmailTo", value)} />
            <Field label="รายงานจอง CC" value={settings.bookingEmailCc} onChange={(value) => update("bookingEmailCc", value)} />
            <Field label="รายงานขาย To" value={settings.salesEmailTo} onChange={(value) => update("salesEmailTo", value)} />
            <Field label="รายงานขาย CC" value={settings.salesEmailCc} onChange={(value) => update("salesEmailCc", value)} />
          </div>
        </SectionCard>

        <SectionCard title="กลุ่ม LINE เริ่มต้น" icon={<MessageCircle size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <LineGroupSelect
              label="กลุ่มรายงานจอง"
              value={settings.bookingLineGroupId}
              groups={groups}
              loading={loadingGroups}
              onChange={(value) => update("bookingLineGroupId", value)}
            />
            <LineGroupSelect
              label="กลุ่มรายงานขาย"
              value={settings.salesLineGroupId}
              groups={groups}
              loading={loadingGroups}
              onChange={(value) => update("salesLineGroupId", value)}
            />
          </div>
          <button
            type="button"
            onClick={() => loadGroups().catch((err) => setError(err.message))}
            className="min-h-11 rounded-2xl border border-brand/50 px-3 text-sm font-semibold text-brand"
          >
            Refresh กลุ่ม LINE
          </button>
        </SectionCard>

        <NativeButton type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          บันทึกตั้งค่าระบบ
        </NativeButton>
      </form>

      <form onSubmit={addLineGroup} className="mt-4">
        <SectionCard title="เพิ่มกลุ่ม LINE ด้วย Group ID" icon={<MessageCircle size={18} />}>
          <p className="text-sm leading-6 text-soft">
            ถ้ายังไม่รู้ Group ID ให้เชิญ LINE OA เข้ากลุ่มแล้วพิมพ์ข้อความ 1 ครั้ง จากนั้นไปดูที่หน้า LINE หรือกด Refresh กลุ่ม
          </p>
          <Field label="ชื่อกลุ่ม" value={newGroupName} onChange={setNewGroupName} placeholder="เช่น กลุ่มขออนุมัติ" />
          <Field label="Group ID" value={newGroupId} onChange={setNewGroupId} placeholder="เช่น Cxxxxxxxx..." />
          <NativeButton type="submit" variant="secondary" disabled={addingGroup} className="w-full">
            {addingGroup ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            เพิ่มกลุ่ม LINE
          </NativeButton>
        </SectionCard>
      </form>
    </NativeAppShell>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function LineGroupSelect({
  label,
  value,
  groups,
  loading,
  onChange
}: {
  label: string;
  value: string;
  groups: LineGroup[];
  loading: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none focus:border-brand"
      >
        <option value="">{loading ? "กำลังโหลด..." : "ใช้กลุ่มล่าสุด/ยังไม่กำหนด"}</option>
        {groups.map((group) => (
          <option key={group.groupId} value={group.groupId}>
            {group.name || group.groupId}
          </option>
        ))}
      </select>
    </label>
  );
}
