"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Eye, FileSliders, Loader2, Plus, Save, Upload } from "lucide-react";
import { FilterChip, PageContainer, PageTitle, SectionCard, TopMenuButton } from "@/app/components/ui";
import type { DocumentFieldConfig, DocumentTemplateConfig, DocumentTemplateId } from "@/lib/documents/document-types";

type PreviewData = Record<string, string>;

const fieldOptions = [
  ["customerName", "ชื่อลูกค้า"],
  ["idCard", "เลขบัตร / เลขผู้เสียภาษี"],
  ["phone", "เบอร์โทร"],
  ["address", "ที่อยู่"],
  ["plate", "ทะเบียน"],
  ["carBrand", "ยี่ห้อ"],
  ["carModel", "รุ่นรถยนต์"],
  ["year", "ปีจด"],
  ["color", "สี"],
  ["vin", "เลขตัวถัง / เลขตัวรถ"],
  ["engineNo", "เลขเครื่อง"],
  ["salePrice", "ราคารถ / ราคาขาย"],
  ["bookingPrice", "เงินจอง"],
  ["financeAmount", "ยอดจัด"],
  ["deliveryDate", "วันส่งมอบ"],
  ["deliveryLocation", "สถานที่ส่งมอบ"],
  ["sellerName", "ชื่อผู้ขาย"],
  ["approverName", "ผู้อนุมัติ"],
  ["signatureName", "ชื่อผู้ลงนาม"],
  ["transactionDate", "วันที่ทำรายการ"]
] as const;

const fieldLabelMap = Object.fromEntries(fieldOptions);

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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
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
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
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

  function addField(key: string) {
    if (!selectedTemplate || selectedTemplate.fields[key]) {
      setFieldKey(key);
      return;
    }
    setTemplates((current) =>
      current.map((template) => {
        if (template.id !== templateId) return template;
        return {
          ...template,
          fields: {
            ...template.fields,
            [key]: { page: 1, x: 120, y: 700, fontSize: 10 }
          }
        };
      })
    );
    setFieldKey(key);
  }

  async function uploadTemplatePdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedTemplate) return;
    setUploadingTemplate(true);
    setError("");
    setMessage("");
    try {
      const res = await api<{ template: DocumentTemplateConfig }>("/api/documents/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          base64: await fileToBase64(file)
        })
      });
      setTemplates((current) => current.map((template) => template.id === templateId ? res.template : template));
      setMessage("อัปโหลด PDF ฟอร์มเดิมเป็น template แล้ว กด Preview เพื่อเช็กตำแหน่งข้อความ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลด PDF template ไม่สำเร็จ");
    } finally {
      setUploadingTemplate(false);
    }
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
            {selectedTemplate && (
              <div className="rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-6 text-soft">
                <p className="font-bold text-white">PDF Template ปัจจุบัน</p>
                <p className="break-all">{selectedTemplate.fileName}</p>
              </div>
            )}
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand/50 bg-brand/10 px-3 font-black text-brand">
              {uploadingTemplate ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              Upload PDF ฟอร์มเดิม
              <input type="file" accept="application/pdf,.pdf" onChange={uploadTemplatePdf} className="sr-only" />
            </label>
          </SectionCard>

          <SectionCard title="ปรับ Field" icon={<FileSliders size={18} />}>
            <label>
              <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">Field</span>
              <select value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand">
                {fieldKeys.map((key) => (
                  <option key={key} value={key}>{fieldLabelMap[key] || key} ({key})</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">เพิ่ม Field จากข้อมูล CRM</span>
              <div className="flex gap-2">
                <select onChange={(event) => event.target.value && addField(event.target.value)} value="" className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand">
                  <option value="">เลือก field ที่ต้องการพิมพ์ลง PDF</option>
                  {fieldOptions.map(([key, label]) => (
                    <option key={key} value={key}>{label} ({key})</option>
                  ))}
                </select>
                <button type="button" onClick={() => addField("customerName")} className="flex h-12 w-12 items-center justify-center rounded-lg border border-line text-white">
                  <Plus size={18} />
                </button>
              </div>
            </label>

            {field && (
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="page" value={field.page || 1} onChange={(value) => updateField({ page: Math.max(1, value || 1) })} />
                <NumberInput label="x" value={field.x} onChange={(value) => updateField({ x: value })} />
                <NumberInput label="y" value={field.y} onChange={(value) => updateField({ y: value })} />
                <NumberInput label="font" value={field.fontSize} onChange={(value) => updateField({ fontSize: value })} />
                <NumberInput label="width" value={field.width || 0} onChange={(value) => updateField({ width: value || undefined })} />
                <label>
                  <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">type</span>
                  <select value={field.type || "text"} onChange={(event) => updateField({ type: event.target.value as DocumentFieldConfig["type"] })} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand">
                    <option value="text">text</option>
                    <option value="date">date</option>
                    <option value="checkbox">checkbox</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-bold text-[#dce2eb]">checkbox value</span>
                  <input value={field.value || ""} onChange={(event) => updateField({ value: event.target.value })} className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand" />
                </label>
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
            <div className="space-y-3">
              <a href={previewUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-lg bg-brand px-3 font-black text-ink">
                เปิด Preview เต็มหน้า
              </a>
              <object data={previewUrl} type="application/pdf" className="h-[78vh] w-full rounded-lg border border-line bg-white">
                <iframe title="Template Preview" src={previewUrl} className="h-[78vh] w-full rounded-lg border border-line bg-white" />
              </object>
            </div>
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
