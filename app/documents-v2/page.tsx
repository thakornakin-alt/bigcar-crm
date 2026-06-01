"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import type { ReportHistoryItem } from "@/lib/types";

type FieldItem = { name: string; type: string };

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

export default function DocumentsV2Page() {
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [pngUrl, setPngUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  async function loadFields() {
    setError("");
    const res = await api<{ ok: boolean; fields: FieldItem[] }>("/api/documents-v2/fields");
    setFields(res.fields || []);
  }

  async function loadReports() {
    setError("");
    const res = await api<{ reports: ReportHistoryItem[] }>("/api/reports/history?type=booking");
    setReports((res.reports || []).filter((r) => r.type === "booking"));
  }

  async function preview() {
    try {
      setLoading(true);
      setError("");
      const blob = await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport })
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function exportPng() {
    try {
      setLoading(true);
      setError("");
      const blob = await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport })
      });
      const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
      pdfjs.GlobalWorkerOptions.workerSrc = "";
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas ไม่พร้อม");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!pngBlob) throw new Error("แปลง PNG ไม่สำเร็จ");
      if (pngUrl) URL.revokeObjectURL(pngUrl);
      const url = URL.createObjectURL(pngBlob);
      setPngUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export PNG ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 text-white">
      <h1 className="text-2xl font-bold">DocumentGeneratorV2</h1>
      <p className="text-sm text-gray-300">AcroForm only · temporary-receipt.pdf</p>
      {error ? <div className="rounded border border-red-500/40 bg-red-900/30 p-3 text-red-100">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button onClick={loadFields} className="rounded bg-emerald-500 px-4 py-2 font-semibold text-black">โหลดรายชื่อ Fields</button>
        <button onClick={loadReports} className="rounded border border-white/20 px-4 py-2">โหลดรายงานจอง</button>
        <button onClick={preview} disabled={loading} className="rounded border border-white/20 px-4 py-2">{loading ? <Loader2 className="inline animate-spin" size={16} /> : <Eye className="inline" size={16} />} Preview PDF</button>
        <button onClick={exportPng} disabled={loading} className="rounded border border-white/20 px-4 py-2"><ImageIcon className="inline" size={16} /> Export PNG</button>
      </div>

      <div className="rounded border border-white/10 p-3">
        <label className="mb-2 block text-sm">เลือกรายงานจอง</label>
        <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)} className="w-full rounded bg-black/40 p-2">
          <option value="">-- เลือก --</option>
          {reports.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.customerName} · {r.plate}</option>)}
        </select>
      </div>

      <div className="rounded border border-white/10 p-3">
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><FileText size={16} /> Fields</h2>
        <pre className="max-h-56 overflow-auto text-xs text-gray-300">{JSON.stringify(fields, null, 2)}</pre>
      </div>

      {previewUrl ? (
        <div className="rounded border border-white/10 p-3">
          <h2 className="mb-2 font-semibold">Preview PDF</h2>
          <iframe src={previewUrl} className="h-[70vh] w-full rounded bg-white" />
          <a href={previewUrl} download="temporary-receipt-v2.pdf" className="mt-2 inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 font-semibold text-black">
            <Download size={16} /> Download PDF
          </a>
        </div>
      ) : null}

      {pngUrl ? (
        <div className="rounded border border-white/10 p-3">
          <h2 className="mb-2 font-semibold">PNG</h2>
          <img src={pngUrl} alt="PNG preview" className="max-w-full rounded bg-white" />
          <a href={pngUrl} download="temporary-receipt-v2.png" className="mt-2 inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 font-semibold text-black">
            <Download size={16} /> Download PNG
          </a>
        </div>
      ) : null}
    </div>
  );
}

