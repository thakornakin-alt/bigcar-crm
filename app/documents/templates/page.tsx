"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileSliders, Loader2, Save } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { DocumentFieldConfig, DocumentTemplateConfig, DocumentTemplateId } from "@/lib/documents/document-types";

type PreviewData = Record<string, string>;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  if (!response.ok) throw new Error("Request failed");
  return (await response.blob()) as T;
}

function sampleData(): PreviewData {
  return {
    customerName: "คุณเอก ทดสอบ",
    phone: "091-778-5117",
    idCard: "1-2345-67890-12-3",
    address: "184 ถนนพระราม 3 แขวงบางโคล่ เขตบางคอแหลม กรุงเทพฯ",
    plate: "กข 1234",
    carBrand: "TOYOTA",
    carModel: "COMMUTER 2.8 AT",
    year: "2021",
    color: "ขาว",
    vin: "MR0TEST1234567890",
    engineNo: "1GD1234567",
    salePrice: "1,064,000",
    bookingPrice: "10,000",
    financeAmount: "850,000",
    deliveryLocation: "โกดังบางนา",
    sellerName: "บิ๊ก",
    approverName: "ผู้จัดการ",
    signatureName: "คุณเอก ทดสอบ",
    paymentType: "finance"
  };
}

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplateConfig[]>([]);
  const [templateId, setTemplateId] = useState<DocumentTemplateId>("sale-summary");
  const [fieldKey, setFieldKey] = useState("customerName");
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ templates: DocumentTemplateConfig[] }>("/api/documents/templates")
      .then((res) => setTemplates(res.templates || []))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectedTemplate = templates.find((template) => template.id === templateId);
  const fieldKeys = useMemo(() => Object.keys(selectedTemplate?.fields || {}), [selectedTemplate]);
  const field = selectedTemplate?.fields[fieldKey];

  useEffect(() => {
    if (fieldKeys.length && !fieldKeys.includes(fieldKey)) setFieldKey(fieldKeys[0]);
  }, [fieldKey, fieldKeys]);

  function updateField(patch: Partial<DocumentFieldConfig>) {
    setTemplates((current) =>
      current.map((template) => {
        if (template.id !== templateId) return template;
        return {
          ...template,
          fields: {
            ...template.fields,
            [fieldKey]: {
              ...template.fields[fieldKey],
              ...patch
            }
          }
        };
      })
    );
  }

  async function saveConfig() {
    if (!selectedTemplate) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/api/documents/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fields: selectedTemplate.fields })
      });
      setMessage("บันทึกตำแหน่ง field แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    if (!selectedTemplate) return;
    setLoadingPreview(true);
    setError("");
    try {
      const blob = await api<Blob>("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, data: sampleData(), fields: selectedTemplate.fields })
      });
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview ไม่สำเร็จ");
    } finally {
      setLoadingPreview(false);
    }
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="ตั้งค่า Template PDF"
        subtitle="ปรับตำแหน่ง x/y และขนาดตัวอักษรสำหรับฟอร์มบริษัท"
        actions={<TopMenuButton href="/documents/create" icon={<FileSliders size={18} />}>สร้างเอกสาร</TopMenuButton>}
      />

      {(message || error) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-4">
          <SectionCard title="เลือก Template" icon={<FileSliders size={18} />}>
            <div className="grid gap-2">
              {templates.map((template) => (
                <FilterChip key={template.id} active={template.id === templateId} onClick={() => setTemplateId(template.id)}>
                  {template.title}
                </FilterChip>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="ปรับ Field" icon={<FileSliders size={18} />}>
            <label>
              <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">Field</span>
              <select value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand">
                {fieldKeys.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </label>

            {field && (
              <div className="grid grid-cols-3 gap-2">
                <NumberInput label="x" value={field.x} onChange={(value) => updateField({ x: value })} />
                <NumberInput label="y" value={field.y} onChange={(value) => updateField({ y: value })} />
                <NumberInput label="font" value={field.fontSize} onChange={(value) => updateField({ fontSize: value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={preview} disabled={loadingPreview} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 font-black text-brand disabled:opacity-60">
                {loadingPreview ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                Preview
              </button>
              <button type="button" onClick={saveConfig} disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 font-black text-ink disabled:opacity-60">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                บันทึก JSON
              </button>
            </div>
          </SectionCard>
        </section>

        <SectionCard title="Live Preview" icon={<Eye size={18} />}>
          {previewUrl ? (
            <iframe title="Template Preview" src={previewUrl} className="h-[78vh] w-full rounded-lg border border-line bg-white" />
          ) : (
            <div className="rounded-lg border border-dashed border-line bg-[#0b0d11] px-4 py-10 text-center text-soft">
              กด Preview เพื่อเช็กตำแหน่งข้อความบนแบบฟอร์ม
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
      />
    </label>
  );
}
