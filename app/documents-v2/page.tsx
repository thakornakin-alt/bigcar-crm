"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, ExternalLink, FileText, Image as ImageIcon, Loader2, Share2 } from "lucide-react";
import type { ReportHistoryItem } from "@/lib/types";
import { DOC_V2_TEMPLATE_ID } from "@/lib/documents-v2/types";
import { documentTemplatesV2, getDocumentV2Templates, type DocumentV2TemplateId } from "@/lib/documents-v2/template-config";
import type { DocumentV2FieldKey, DocumentV2FieldMapping, DocumentV2MappedValue } from "@/lib/documents-v2/mapping-store";
import { mapBookingToDocumentV2 } from "@/lib/documents-v2/types";
import type { DocumentV2ResolveDebug, ResolvedDocumentV2Data } from "@/lib/documents-v2/resolve-data";

type FieldItem = { name: string; type: string };
type FieldsDebug = {
  selectedTemplate: { id: string; fileName: string; path: string };
  fetchStatus: number;
  fieldsCount: number;
  fieldNames: string[];
};

const mappingOptions: Array<{ key: DocumentV2FieldKey; label: string }> = [
  { key: "contractDate", label: "วันที่สัญญา" },
  { key: "currentDate", label: "วันที่ปัจจุบัน" },
  { key: "customerName", label: "ชื่อลูกค้า" },
  { key: "customerAddress", label: "ที่อยู่ลูกค้า" },
  { key: "idCard", label: "เลขบัตรประชาชน" },
  { key: "plateNo", label: "ทะเบียน" },
  { key: "brand", label: "ยี่ห้อรถ" },
  { key: "model", label: "รุ่นรถ" },
  { key: "year", label: "ปีรถ" },
  { key: "color", label: "สี" },
  { key: "engineNo", label: "เลขเครื่อง" },
  { key: "chassisNo", label: "เลขตัวถัง" },
  { key: "sellPrice", label: "ราคาขาย" },
  { key: "deposit", label: "เงินจอง" },
  { key: "remainingAmount", label: "ยอดคงเหลือ" },
  { key: "saleName", label: "ชื่อเซลล์" }
];

const keyLabel: Record<DocumentV2FieldKey, string> = Object.fromEntries(
  mappingOptions.map((m) => [m.key, m.label])
) as Record<DocumentV2FieldKey, string>;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Request failed");
    }
    throw new Error("Request failed");
  }
  if (contentType.includes("application/json")) return response.json();
  return (await response.blob()) as T;
}

function safeFilePart(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function downloadObjectUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function DocumentsV2Page() {
  const templates = getDocumentV2Templates();
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [pngUrl, setPngUrl] = useState("");
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [pngFileName, setPngFileName] = useState("document-v2.png");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [templateId, setTemplateId] = useState<DocumentV2TemplateId>(DOC_V2_TEMPLATE_ID);
  const [loadedTemplateFile, setLoadedTemplateFile] = useState("");
  const [debug, setDebug] = useState<FieldsDebug | null>(null);
  const [isTemplateReady, setIsTemplateReady] = useState(false);
  const [mapping, setMapping] = useState<DocumentV2FieldMapping>({});
  const [probeField, setProbeField] = useState("");
  const [probeValue, setProbeValue] = useState("TEST-123");
  const reportSource: "sales" = "sales";
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [resolvedData, setResolvedData] = useState<ResolvedDocumentV2Data | null>(null);
  const [resolveDebug, setResolveDebug] = useState<DocumentV2ResolveDebug | null>(null);
  const [resolvingData, setResolvingData] = useState(false);
  const isHydratingMappingRef = useRef(false);

  const selectedTemplate = documentTemplatesV2[templateId];
  const isMappingLocked = Boolean(selectedTemplate.mappingLocked);
  const isDev = process.env.NODE_ENV === "development";

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );
  const sampleData = useMemo(() => resolvedData || mapBookingToDocumentV2(selectedReport), [resolvedData, selectedReport]);
  const rawReportData = useMemo(
    () => ({
      ...Object.fromEntries(Object.entries((selectedReport || {}) as Record<string, unknown>).map(([k, v]) => [k, v == null ? "" : String(v)])),
      ...(resolvedData || {})
    }),
    [resolvedData, selectedReport]
  );
  const reportRawKeys = useMemo(() => Object.keys(rawReportData).sort((a, b) => a.localeCompare(b)), [rawReportData]);
  const mappedFieldCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping]
  );
  const mappedNonEmptyCount = useMemo(() => {
    return Object.entries(mapping).reduce((acc, [, key]) => {
      if (!key) return acc;
      const value = String(key).startsWith("raw:")
        ? rawReportData[String(key).slice(4)]
        : (sampleData as Record<string, unknown>)[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return acc + 1;
      return acc;
    }, 0);
  }, [mapping, rawReportData, sampleData]);
  const canRunGenerate = isTemplateReady && reportsLoaded && Boolean(selectedReport) && !resolvingData && saveState !== "saving" && saveState !== "dirty";

  async function loadFields() {
    try {
      setError("");
      setIsTemplateReady(false);
      const templateProbe = await fetch(selectedTemplate.path, { method: "GET", cache: "no-store" });
      if (!templateProbe.ok) {
        setDebug({
          selectedTemplate: selectedTemplate,
          fetchStatus: templateProbe.status,
          fieldsCount: 0,
          fieldNames: []
        });
        throw new Error("ไม่พบไฟล์ template");
      }
      const res = await api<{
        ok: boolean;
        fields: FieldItem[];
        templateId?: string;
        templateFile?: string;
        debug?: FieldsDebug;
      }>(`/api/documents-v2/fields?templateId=${encodeURIComponent(templateId)}`);
      setFields(res.fields || []);
      setLoadedTemplateFile(String(res.templateFile || selectedTemplate.fileName));
      setDebug(res.debug || null);
      if (!res.fields?.length) {
        setError("ไม่พบ AcroForm fields ในไฟล์นี้");
        return;
      }
      try {
        const mappingRes = await api<{ ok: boolean; mapping: DocumentV2FieldMapping }>(`/api/documents-v2/mapping?templateId=${encodeURIComponent(templateId)}`);
        setMapping(mappingRes.mapping || {});
      } catch {}
      setIsTemplateReady(true);
    } catch (e) {
      setFields([]);
      setLoadedTemplateFile(selectedTemplate.fileName);
      const message = e instanceof Error ? e.message : "โหลด fields ไม่สำเร็จ";
      setError(message);
      setIsTemplateReady(false);
    }
  }

  async function loadReports() {
    setError("");
    setReportsLoaded(false);
    const res = await api<{ reports: ReportHistoryItem[] }>(`/api/reports/history?type=${reportSource}`);
    const all = res.reports || [];
    const filtered = all.filter((r) => {
      const typeOk = String(r.type || "").toLowerCase() === reportSource;
      const hasCore = Boolean(String(r.customerName || "").trim() || String(r.plate || "").trim());
      return typeOk || hasCore;
    });
    setReports(filtered);
    setSelectedReportId(filtered[0]?.id || "");
    setReportsLoaded(true);
    if (!filtered.length) {
      setError("ไม่พบรายงานขายในระบบ");
    }
  }

  async function loadResolvedData(report: ReportHistoryItem | null) {
    if (!report) {
      setResolvedData(null);
      setResolveDebug(null);
      return;
    }
    try {
      setResolvingData(true);
      const res = await api<{ ok: boolean; data: ResolvedDocumentV2Data; debug: DocumentV2ResolveDebug }>("/api/documents-v2/resolve-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, templateId })
      });
      setResolvedData(res.data || null);
      setResolveDebug(res.debug || null);
    } catch (e) {
      setResolvedData(mapBookingToDocumentV2(report) as ResolvedDocumentV2Data);
      setResolveDebug(null);
      setError(e instanceof Error ? e.message : "โหลดข้อมูลที่จะใช้จริงไม่สำเร็จ");
    } finally {
      setResolvingData(false);
    }
  }

  useEffect(() => {
    loadResolvedData(selectedReport);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId, templateId]);

  async function loadMapping() {
    try {
      isHydratingMappingRef.current = true;
      const res = await api<{ ok: boolean; mapping: DocumentV2FieldMapping }>(`/api/documents-v2/mapping?templateId=${encodeURIComponent(templateId)}`);
      setMapping(res.mapping || {});
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString("th-TH"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลด mapping ไม่สำเร็จ");
      setSaveState("error");
    } finally {
      setTimeout(() => {
        isHydratingMappingRef.current = false;
      }, 0);
    }
  }

  async function saveMapping() {
    try {
      setError("");
      setSaveState("saving");
      await api<{ ok: boolean; mapping: DocumentV2FieldMapping }>("/api/documents-v2/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, mapping })
      });
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString("th-TH"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึก mapping ไม่สำเร็จ");
      setSaveState("error");
    }
  }

  useEffect(() => {
    if (isMappingLocked) return;
    if (isHydratingMappingRef.current) return;
    if (Object.keys(mapping).length === 0) return;
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
    const timer = setTimeout(() => {
      saveMapping();
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMappingLocked, mapping, templateId]);

  async function preview() {
    if (!isTemplateReady) {
      setError("ไม่พบ AcroForm fields ในไฟล์นี้");
      return;
    }
    if (!selectedReport) {
      setError("กรุณาโหลดและเลือกรายงานขายก่อน Preview");
      return;
    }
    if (!reportsLoaded) {
      setError("กรุณาโหลดรายงานขายก่อน");
      return;
    }
    if (saveState === "saving" || saveState === "dirty") {
      setError("กำลังบันทึก Mapping กรุณารอสักครู่แล้วลองใหม่");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const blob = await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport, templateId })
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function previewProbe() {
    if (!isTemplateReady || !probeField || !probeValue) {
      setError("กรอก Field และค่า TEST ก่อน");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const blob = await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport, templateId, fieldProbeName: probeField, fieldProbeValue: probeValue })
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview Probe ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function exportPng() {
    if (!isTemplateReady) {
      setError("ไม่พบ AcroForm fields ในไฟล์นี้");
      return;
    }
    if (!selectedReport) {
      setError("กรุณาโหลดและเลือกรายงานขายก่อน Export");
      return;
    }
    if (!reportsLoaded) {
      setError("กรุณาโหลดรายงานขายก่อน");
      return;
    }
    if (saveState === "saving" || saveState === "dirty") {
      setError("กำลังบันทึก Mapping กรุณารอสักครู่แล้วลองใหม่");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const blob = await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport, templateId })
      });
      const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas ไม่พร้อม");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const nextPngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!nextPngBlob) throw new Error("แปลง PNG ไม่สำเร็จ");
      if (pngUrl.startsWith("blob:")) URL.revokeObjectURL(pngUrl);
      const fileBase = [
        "sale-contract",
        safeFilePart(sampleData.customerName),
        safeFilePart(sampleData.plateNo)
      ].filter(Boolean).join("-");
      const fileName = `${fileBase || "document-v2"}.png`;
      const url = URL.createObjectURL(nextPngBlob);
      setPngUrl(url);
      setPngBlob(nextPngBlob);
      setPngFileName(fileName);
      downloadObjectUrl(url, fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export PNG ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function sharePng() {
    if (!pngBlob) {
      setError("ยังไม่มีไฟล์ PNG กรุณากดเซฟ PNG ก่อน");
      return;
    }
    try {
      const file = new File([pngBlob], pngFileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          files: [file],
          title: "สัญญาซื้อขายรถยนต์",
          text: "เอกสาร PNG จาก BIG CAR CRM"
        });
        return;
      }
      if (pngUrl) window.open(pngUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "แชร์/บันทึกรูปไม่สำเร็จ");
    }
  }

  function openPng() {
    if (!pngUrl) {
      setError("ยังไม่มีไฟล์ PNG กรุณากดเซฟ PNG ก่อน");
      return;
    }
    window.open(pngUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 text-white">
      <h1 className="text-2xl font-bold">DocumentGeneratorV2</h1>
      <p className="text-sm text-gray-300">AcroForm only · ใช้ไฟล์เดียวกันทั้ง Load Fields + Preview/Export</p>
      {error ? <div className="rounded border border-red-500/40 bg-red-900/30 p-3 text-red-100">{error}</div> : null}

      <div className="rounded border border-white/10 p-3">
        <label className="mb-2 block text-sm">แหล่งข้อมูล</label>
        <div className="rounded bg-black/40 p-2 text-sm">รายงานขาย (ล็อกถาวร)</div>
      </div>

      <div className="rounded border border-white/10 p-3">
        <label className="mb-2 block text-sm">Template</label>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value as DocumentV2TemplateId);
            setFields([]);
            setDebug(null);
            setError("");
            setIsTemplateReady(false);
          }}
          className="w-full rounded bg-black/40 p-2"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.fileName})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={loadFields} className="rounded bg-emerald-500 px-4 py-2 font-semibold text-black">โหลดรายชื่อ Fields</button>
        <button onClick={loadReports} className="rounded border border-white/20 px-4 py-2">โหลดรายงานขาย</button>
        <button onClick={loadMapping} className="rounded border border-white/20 px-4 py-2">โหลด Mapping</button>
        <button
          onClick={saveMapping}
          disabled={saveState === "saving" || isMappingLocked}
          className={`rounded border px-4 py-2 ${saveState === "saving" ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/20"}`}
        >
          {isMappingLocked ? "Mapping ล็อกแล้ว" : saveState === "saving" ? "กำลังบันทึก..." : saveState === "saved" ? "บันทึกแล้ว" : saveState === "error" ? "บันทึกล้มเหลว" : "บันทึก Mapping"}
        </button>
        <button onClick={preview} disabled={loading || !canRunGenerate} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50">{loading ? <Loader2 className="inline animate-spin" size={16} /> : <Eye className="inline" size={16} />} Preview PDF</button>
        <button onClick={previewProbe} disabled={loading} className="rounded border border-yellow-300/40 px-4 py-2 text-yellow-200">ทดสอบ Field</button>
        <button onClick={exportPng} disabled={loading || !canRunGenerate} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50"><ImageIcon className="inline" size={16} /> เซฟ PNG</button>
      </div>
      <div className="text-xs text-gray-300 space-y-1">
        <div>
          สถานะ Mapping: {isMappingLocked ? "ล็อกสำหรับ PDF สัญญาซื้อขายรถยนต์" : saveState === "dirty" ? "มีการแก้ไข (รอบันทึกอัตโนมัติ)" : saveState === "saving" ? "กำลังบันทึก..." : saveState === "saved" ? "บันทึกแล้ว" : saveState === "error" ? "บันทึกล้มเหลว" : "ยังไม่เริ่ม"} {lastSavedAt && !isMappingLocked ? `· ล่าสุด ${lastSavedAt}` : ""}
        </div>
        <div>
          ความพร้อมข้อมูล: แมพแล้ว {mappedFieldCount} ช่อง · มีข้อมูลจริง {mappedNonEmptyCount} ช่อง
        </div>
        {!canRunGenerate ? (
          <div className="text-amber-300">
            ยัง Preview/Export ไม่ได้: {!isTemplateReady ? "ยังไม่พร้อม template" : !reportsLoaded ? "ยังไม่โหลดรายงานขาย" : !selectedReport ? "ยังไม่เลือกรายงานขาย" : resolvingData ? "กำลังดึงข้อมูลจริงจากทะเบียน" : saveState === "saving" || saveState === "dirty" ? "กำลังบันทึก mapping" : "รอข้อมูล"}
          </div>
        ) : null}
      </div>

      <div className="rounded border border-emerald-400/20 bg-emerald-500/5 p-3">
        <h2 className="mb-2 font-semibold">ข้อมูลที่จะใช้จริง</h2>
        {resolvingData ? (
          <p className="text-sm text-emerald-200">กำลังดึงข้อมูลจากรายงานขายและสต็อกตามทะเบียน...</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <div className="rounded bg-black/30 p-2">ทะเบียน: {sampleData.plateNo || "ไม่มีข้อมูล"}</div>
            <div className="rounded bg-black/30 p-2">เลขเครื่อง: {sampleData.engineNo || "ไม่มีข้อมูล"}</div>
            <div className="rounded bg-black/30 p-2">เลขตัวถัง: {sampleData.chassisNo || "ไม่มีข้อมูล"}</div>
            <div className="rounded bg-black/30 p-2">ที่อยู่: {sampleData.customerAddress || "ไม่มีข้อมูล"}</div>
          </div>
        )}
        {resolveDebug ? (
          <p className="mt-2 text-xs text-gray-400">
            Stock lookup: {resolveDebug.stockFound ? "พบรถ" : "ไม่พบรถ"} · engine={resolveDebug.resolvedEngineNo || "-"} · chassis={resolveDebug.resolvedChassisNo || "-"}
          </p>
        ) : null}
      </div>

      <div className="rounded border border-white/10 p-3">
        <h2 className="mb-2 font-semibold">Field Probe</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            value={probeField}
            onChange={(e) => setProbeField(e.target.value)}
            placeholder="เช่น Text1"
            className="rounded bg-black/40 p-2 text-sm"
          />
          <input
            value={probeValue}
            onChange={(e) => setProbeValue(e.target.value)}
            placeholder="ค่าทดสอบ"
            className="rounded bg-black/40 p-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded border border-white/10 p-3">
        <h2 className="mb-2 font-semibold">Field Mapping</h2>
        {isMappingLocked ? (
          <p className="mb-3 rounded border border-emerald-400/20 bg-emerald-500/10 p-2 text-sm text-emerald-100">
            PDF นี้ล็อก Mapping แล้ว เพื่อไม่ให้ตำแหน่ง/ช่องที่ตั้งไว้ขยับโดยไม่ตั้งใจ
          </p>
        ) : null}
        {!fields.length ? (
          <p className="text-sm text-gray-400">กดโหลดรายชื่อ Fields ก่อน</p>
        ) : (
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.name} className="grid grid-cols-2 gap-2">
                <div className="rounded bg-black/30 p-2 text-sm">{f.name}</div>
                <div className="space-y-1">
                  <select
                    value={mapping[f.name] || ""}
                    disabled={isMappingLocked}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [f.name]: e.target.value as DocumentV2MappedValue }))}
                    className="w-full rounded bg-black/40 p-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">-- ไม่แมพ --</option>
                    {mappingOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                    {reportRawKeys.length ? <option value="" disabled>──────── รายงานขาย (raw) ────────</option> : null}
                    {reportRawKeys.map((rawKey) => (
                      <option key={`raw-${rawKey}`} value={`raw:${rawKey}`}>
                        raw: {rawKey}
                      </option>
                    ))}
                  </select>
                  {mapping[f.name] ? (
                    <div className="text-xs text-emerald-300">
                      {String(mapping[f.name]).startsWith("raw:")
                        ? `ตัวอย่าง (raw): ${String(mapping[f.name]).slice(4)} = ${String(rawReportData[String(mapping[f.name]).slice(4)] || "ไม่มีข้อมูล")}`
                        : `ตัวอย่าง: ${keyLabel[mapping[f.name] as DocumentV2FieldKey]} = ${String((sampleData as Record<string, unknown>)[mapping[f.name] as DocumentV2FieldKey] || "ไม่มีข้อมูล")}`}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded border border-white/10 p-3">
        <label className="mb-2 block text-sm">เลือกรายงานขาย</label>
        <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)} className="w-full rounded bg-black/40 p-2">
          <option value="">-- เลือก --</option>
          {reports.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.customerName} · {r.plate} · {r.type}</option>)}
        </select>
      </div>

      <div className="rounded border border-white/10 p-3">
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><FileText size={16} /> Fields</h2>
        <p className="mb-2 text-xs text-gray-300">โหลดไฟล์จริง: {loadedTemplateFile || "-"}</p>
        {isDev && debug ? (
          <pre className="mb-2 max-h-40 overflow-auto text-xs text-emerald-200">
            {JSON.stringify(debug, null, 2)}
          </pre>
        ) : null}
        <pre className="max-h-56 overflow-auto text-xs text-gray-300">{JSON.stringify(fields, null, 2)}</pre>
      </div>

      {previewUrl ? (
        <div className="rounded border border-white/10 p-3">
          <h2 className="mb-2 font-semibold">Preview PDF</h2>
          <iframe src={previewUrl} className="h-[70vh] w-full rounded bg-white" />
          <a href={previewUrl} download={loadedTemplateFile || selectedTemplate.fileName || "document-v2.pdf"} className="mt-2 inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 font-semibold text-black">
            <Download size={16} /> Download PDF
          </a>
        </div>
      ) : null}

      {pngUrl ? (
        <div className="rounded border border-white/10 p-3">
          <h2 className="mb-2 font-semibold">PNG</h2>
          <img src={pngUrl} alt="PNG preview" className="max-w-full rounded bg-white" />
          <p className="mt-2 text-xs text-gray-300">บน iPhone ถ้าปุ่ม Download ไม่เข้า Photos ให้กด “แชร์/บันทึกรูป” แล้วเลือก Save Image</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={pngUrl} download={pngFileName} className="inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 font-semibold text-black">
              <Download size={16} /> Download PNG
            </a>
            <button onClick={sharePng} className="inline-flex items-center gap-2 rounded border border-white/20 px-3 py-2 font-semibold text-white">
              <Share2 size={16} /> แชร์/บันทึกรูป
            </button>
            <button onClick={openPng} className="inline-flex items-center gap-2 rounded border border-white/20 px-3 py-2 font-semibold text-white">
              <ExternalLink size={16} /> เปิดรูปเต็ม
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
