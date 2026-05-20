"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Save, Settings } from "lucide-react";
import { PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import {
  BigCarSystemSettings,
  defaultSystemSettings,
  readSystemSettings,
  writeSystemSettings
} from "@/lib/client-settings";
import type { LineGroup } from "@/lib/types";

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
  const [settings, setSettings] = useState<BigCarSystemSettings>(defaultSystemSettings);
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);

  useEffect(() => {
    setSettings(readSystemSettings());
    loadGroups().catch((err) => setError(err.message));
  }, []);

  async function loadGroups() {
    setLoadingGroups(true);
    try {
      const data = await api<{ groups: LineGroup[] }>("/api/line/groups");
      setGroups(data.groups);
    } finally {
      setLoadingGroups(false);
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
    <PageContainer>
      <PageTitle
        title="ตั้งค่าระบบ"
        subtitle="กำหนดค่าเริ่มต้นสำหรับรายงานจอง รายงานขาย และ LINE"
        actions={
          <TopMenuButton href="/" icon={<ArrowLeft size={18} />}>
            หน้าแรก
          </TopMenuButton>
        }
      />

      {(message || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{error || message}</span>
        </div>
      )}

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
            className="min-h-11 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand"
          >
            Refresh กลุ่ม LINE
          </button>
        </SectionCard>

        <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-60">
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          บันทึกตั้งค่าระบบ
        </button>
      </form>

      <form onSubmit={addLineGroup} className="mt-4">
        <SectionCard title="เพิ่มกลุ่ม LINE ด้วย Group ID" icon={<MessageCircle size={18} />}>
          <p className="text-sm leading-6 text-soft">
            ถ้ายังไม่รู้ Group ID ให้เชิญ LINE OA เข้ากลุ่มแล้วพิมพ์ข้อความ 1 ครั้ง จากนั้นไปดูที่หน้า LINE หรือกด Refresh กลุ่ม
          </p>
          <Field label="ชื่อกลุ่ม" value={newGroupName} onChange={setNewGroupName} placeholder="เช่น กลุ่มขออนุมัติ" />
          <Field label="Group ID" value={newGroupId} onChange={setNewGroupId} placeholder="เช่น Cxxxxxxxx..." />
          <button type="submit" disabled={addingGroup} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-brand/50 px-4 font-bold text-brand disabled:opacity-60">
            {addingGroup ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            เพิ่มกลุ่ม LINE
          </button>
        </SectionCard>
      </form>
    </PageContainer>
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
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
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
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
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
