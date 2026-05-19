"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, RefreshCcw, Send } from "lucide-react";
import { PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { LineGroup, LineWebhookLog } from "@/lib/types";

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

export default function LineSettingsPage() {
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [message, setMessage] = useState("ทดสอบส่งข้อความจาก Big Car CRM");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lineStatus, setLineStatus] = useState<{
    config: { hasChannelId: boolean; hasChannelSecret: boolean; hasChannelAccessToken: boolean; webhookUrl: string };
    logs: LineWebhookLog[];
  } | null>(null);

  async function loadGroups() {
    setError("");
    const [data, statusData] = await Promise.all([
      api<{ groups: LineGroup[] }>("/api/line/groups"),
      api<{ config: { hasChannelId: boolean; hasChannelSecret: boolean; hasChannelAccessToken: boolean; webhookUrl: string }; logs: LineWebhookLog[] }>("/api/line/status")
    ]);
    setGroups(data.groups);
    setLineStatus(statusData);
    setSelectedGroupId((current) => current || data.groups[0]?.groupId || "");
  }

  useEffect(() => {
    loadGroups()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    setStatus("");

    try {
      await api("/api/line/test-send", {
        method: "POST",
        body: JSON.stringify({ groupId: selectedGroupId, message })
      });
      setStatus("ส่งข้อความทดสอบเข้า LINE สำเร็จ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง LINE ไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  return (
    <PageContainer>
      <PageTitle
        title="ตั้งค่า LINE"
        subtitle="รับ groupId จาก webhook และทดสอบส่งข้อความเข้า LINE กลุ่ม"
        actions={
          <TopMenuButton href="/" icon={<ArrowLeft size={18} />}>
            ลูกค้า
          </TopMenuButton>
        }
      />

      {(status || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          {error ? <MessageCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{error || status}</span>
        </div>
      )}

      <div className="space-y-4">
        <SectionCard title="Webhook URL" icon={<MessageCircle size={18} />}>
          <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
            ตั้งใน LINE Developers:
            <br />
            <span className="break-all text-white">https://bigcar-crm.vercel.app/api/line/webhook</span>
          </p>
          <p className="text-sm leading-6 text-soft">
            หลังตั้งค่าแล้ว เชิญ Official Account เข้ากลุ่ม LINE และพิมพ์ข้อความในกลุ่ม 1 ครั้ง ระบบจะเก็บกลุ่มมาแสดงด้านล่าง
          </p>
          {lineStatus && (
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <StatusPill label="Channel ID" ok={lineStatus.config.hasChannelId} />
              <StatusPill label="Channel Secret" ok={lineStatus.config.hasChannelSecret} />
              <StatusPill label="Access Token" ok={lineStatus.config.hasChannelAccessToken} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="กลุ่ม LINE ที่จับได้" icon={<RefreshCcw size={18} />}>
          <button
            type="button"
            onClick={() => loadGroups().catch((err) => setError(err.message))}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
            Refresh
          </button>
          {groups.length ? (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  type="button"
                  key={group.groupId}
                  onClick={() => setSelectedGroupId(group.groupId)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    selectedGroupId === group.groupId ? "border-brand bg-[#101720]" : "border-line bg-[#0b0d11]"
                  }`}
                >
                  <p className="font-semibold text-white">{group.name || group.groupId}</p>
                  <p className="mt-1 break-all text-xs text-soft">{group.groupId}</p>
                  <p className="mt-1 text-xs text-soft">ล่าสุด: {group.lastSeenAt || "-"}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-8 text-center text-sm text-soft">
              ยังไม่พบกลุ่ม LINE ให้ตั้ง webhook แล้วเชิญ OA เข้ากลุ่มก่อน
            </p>
          )}
        </SectionCard>

        <SectionCard title="ส่งข้อความทดสอบ" icon={<Send size={18} />}>
          <form onSubmit={sendTest} className="space-y-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="min-h-28 w-full resize-y rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
            />
            <button
              type="submit"
              disabled={sending || !selectedGroupId || !message.trim()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-60"
            >
              {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              ส่ง LINE Test
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Webhook Log ล่าสุด" icon={<MessageCircle size={18} />}>
          {lineStatus?.logs.length ? (
            <div className="space-y-2">
              {lineStatus.logs.map((log, index) => (
                <div key={`${log.receivedAt}-${index}`} className="rounded-lg border border-line bg-[#0b0d11] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{log.receivedAt}</span>
                    <span className={log.signatureValid === "yes" ? "text-brand" : "text-amber-200"}>
                      signature: {log.signatureValid}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-soft">event: {log.eventCount || "0"} / {log.source || "-"}</p>
                  {log.error && <p className="mt-1 break-all text-amber-100">{log.error}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-8 text-center text-sm text-soft">
              ยังไม่มี webhook ยิงเข้ามา ถ้ากด Verify หรือพิมพ์ในกลุ่มแล้ว ตรงนี้ควรมี log
            </p>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`rounded-lg border px-3 py-2 ${ok ? "border-brand/40 bg-green-950/20 text-green-100" : "border-red-400/40 bg-red-950/30 text-red-100"}`}>
      {label}: {ok ? "OK" : "Missing"}
    </span>
  );
}
