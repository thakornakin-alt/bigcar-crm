"use client";

export type OcrImagePayload = {
  base64: string;
  mimeType: string;
  pageNumber?: number;
  pageCount?: number;
};

export type DocumentOcrPayloadResult = {
  payloads: OcrImagePayload[];
  sourceType: "image" | "pdf";
  pageCount: number;
  processedPages: number;
};

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const DEFAULT_PDF_SCALE = 2.25;
const DEFAULT_MAX_PDF_PAGES = 12;

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function imagePayloadToDataUrl(payload: OcrImagePayload) {
  return `data:${payload.mimeType};base64,${payload.base64}`;
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

async function renderPdfToImagePayloads(file: File, maxPages = DEFAULT_MAX_PDF_PAGES): Promise<DocumentOcrPayloadResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pageCount = pdf.numPages;
  const processedPages = Math.min(pageCount, Math.max(1, maxPages));
  const payloads: OcrImagePayload[] = [];

  for (let pageNumber = 1; pageNumber <= processedPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: DEFAULT_PDF_SCALE });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("เครื่องนี้ไม่รองรับการแปลง PDF เป็นภาพ");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    payloads.push({
      base64: dataUrl.split(",")[1] || "",
      mimeType: "image/jpeg",
      pageNumber,
      pageCount
    });
    page.cleanup();
  }

  pdf.destroy();
  return { payloads, sourceType: "pdf", pageCount, processedPages };
}

export async function documentFileToOcrPayloads(file: File, maxPdfPages = DEFAULT_MAX_PDF_PAGES): Promise<DocumentOcrPayloadResult> {
  if (isPdfFile(file)) return renderPdfToImagePayloads(file, maxPdfPages);
  if (!file.type.startsWith("image/")) throw new Error("รองรับ OCR จากรูปภาพหรือ PDF เท่านั้น");
  return {
    payloads: [{ base64: await fileToBase64(file), mimeType: file.type || "image/jpeg", pageNumber: 1, pageCount: 1 }],
    sourceType: "image",
    pageCount: 1,
    processedPages: 1
  };
}

export function mergeOcrRecords(records: Array<Record<string, unknown>>) {
  const merged: Record<string, string> = {};
  const rawText: string[] = [];

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      const text = String(value ?? "").trim();
      if (!text) continue;
      if (key === "rawText") {
        rawText.push(text);
      } else if (!merged[key]) {
        merged[key] = text;
      }
    }
  }

  if (rawText.length) merged.rawText = rawText.join("\n\n");
  return merged;
}
