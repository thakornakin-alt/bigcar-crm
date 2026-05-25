import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { formatThaiDate, getDocumentTemplate } from "@/lib/documents/template-config";
import type { DocumentData, DocumentFieldConfig, DocumentTemplateId } from "@/lib/documents/document-types";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

function absoluteAssetPath(assetPath: string) {
  return path.isAbsolute(assetPath) ? assetPath : path.join(process.cwd(), assetPath);
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function fieldValue(fieldKey: string, field: DocumentFieldConfig, data: DocumentData) {
  if (field.type === "date") return textValue(data[fieldKey]) || formatThaiDate();
  return textValue(data[fieldKey]);
}

function wrapText(value: string, maxChars: number) {
  if (!maxChars || value.length <= maxChars) return [value];

  const lines: string[] = [];
  let current = "";
  for (const part of value.split(/\s+/)) {
    const next = current ? `${current} ${part}` : part;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export async function generateFilledDocumentPdf(input: {
  templateId: DocumentTemplateId;
  data: DocumentData;
  fields?: Record<string, DocumentFieldConfig>;
}) {
  const template = await getDocumentTemplate(input.templateId);
  if (!template) throw new Error("ไม่พบ PDF Template");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const backgroundBytes = await readFile(absoluteAssetPath(template.backgroundPath));
  const isPdfTemplate = template.backgroundPath.toLowerCase().endsWith(".pdf");
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);

  if (isPdfTemplate) {
    const sourcePdf = await PDFDocument.load(backgroundBytes, { ignoreEncryption: true });
    const [embeddedPage] = await pdf.embedPdf(sourcePdf, [0]);
    page.drawPage(embeddedPage, {
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT
    });
  } else {
    const backgroundImage = await pdf.embedJpg(backgroundBytes);
    page.drawImage(backgroundImage, {
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT
    });
  }

  let font;
  try {
    const fontBytes = await readFile(absoluteAssetPath("public/fonts/tahoma.ttf"));
    font = await pdf.embedFont(fontBytes, { subset: true });
  } catch {
    throw new Error("โหลดฟอนต์ภาษาไทยไม่สำเร็จ");
  }

  const fields = input.fields || template.fields;
  for (const [key, field] of Object.entries(fields)) {
    if (field.page !== 1) continue;
    const value = fieldValue(key, field, input.data);
    if (field.type === "checkbox") {
      const selectedValue = textValue(input.data.paymentType || input.data[key]).toLowerCase();
      if (selectedValue && selectedValue === textValue(field.value).toLowerCase()) {
        page.drawText("X", {
          x: field.x,
          y: field.y,
          size: field.fontSize || 12,
          font,
          color: rgb(0.02, 0.04, 0.07)
        });
      }
      continue;
    }

    if (!value) continue;
    const maxChars = field.width ? Math.max(Math.floor(field.width / Math.max((field.fontSize || 10) * 0.45, 1)), 10) : 0;
    const lines = wrapText(value, maxChars);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: field.x,
        y: field.y - index * ((field.fontSize || 10) + 3),
        size: field.fontSize || 10,
        font,
        color: rgb(0.02, 0.04, 0.07)
      });
    });
  }

  return pdf.save();
}
