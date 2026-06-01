import { readFile, readdir } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import type { DocumentV2Data, DocumentV2FieldDebug } from "@/lib/documents-v2/types";

const DEFAULT_TEMPLATE_FILE = "temporary-receipt.pdf";
const CANDIDATE_TEMPLATE_DIRS = [
  "public/document-templates-v2",
  "public/document-templates"
];

function normalizeTemplateFile(input?: string) {
  const file = path.basename(String(input || DEFAULT_TEMPLATE_FILE)).trim();
  return file || DEFAULT_TEMPLATE_FILE;
}

function normalizeNameForMatch(name: string) {
  return String(name || "")
    .normalize("NFC")
    .trim()
    .toLowerCase();
}

async function loadTemplateBytes(templateFile?: string) {
  const normalizedFile = normalizeTemplateFile(templateFile);
  const target = normalizeNameForMatch(normalizedFile);
  for (const dir of CANDIDATE_TEMPLATE_DIRS) {
    const absDir = path.join(process.cwd(), dir);
    try {
      const entries = await readdir(absDir, { withFileTypes: true });
      const fileNames = entries.filter((e) => e.isFile()).map((e) => e.name);

      // 1) exact typed name first
      let matchedName = fileNames.find((name) => name === normalizedFile);
      // 2) case/Unicode-insensitive fallback
      if (!matchedName) {
        matchedName = fileNames.find((name) => normalizeNameForMatch(name) === target);
      }

      if (!matchedName) continue;
      const rel = `${dir}/${matchedName}`;
      const p = path.join(process.cwd(), rel);
      const bytes = await readFile(p);
      return { bytes, path: rel };
    } catch {}
  }
  throw new Error(`ไม่พบไฟล์ template V2: ${normalizedFile}`);
}

export async function listTemplateFieldsV2(templateFile?: string): Promise<{ fields: DocumentV2FieldDebug[]; templatePath: string; templateFile: string }> {
  const { bytes, path: templatePath } = await loadTemplateBytes(templateFile);
  const resolvedTemplateFile = path.basename(templatePath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error(`ไม่พบ AcroForm fields ในไฟล์นี้ (${resolvedTemplateFile})`);
  return {
    templatePath,
    templateFile: resolvedTemplateFile,
    fields: fields.map((f) => ({ name: f.getName(), type: f.constructor.name }))
  };
}

function setTextIfExists(form: ReturnType<PDFDocument["getForm"]>, names: string[], value: string) {
  if (!value) return;
  for (const n of names) {
    try {
      form.getTextField(n).setText(value);
      return;
    } catch {}
  }
}

export async function generateDocumentV2(data: DocumentV2Data, templateFile?: string): Promise<Uint8Array> {
  const { bytes } = await loadTemplateBytes(templateFile);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public/fonts/tahoma.ttf"));
  const thaiFont = await pdf.embedFont(fontBytes, { subset: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("PDF ไม่มี AcroForm fields");
  form.updateFieldAppearances(thaiFont);

  setTextIfExists(form, ["CUSTOMER_NAME", "customerName", "Text1"], data.customerName);
  setTextIfExists(form, ["LICENSE_PLATE", "plateNo", "Text2"], data.plateNo);
  setTextIfExists(form, ["CHASSIS_NO", "chassisNo", "Text3"], data.chassisNo);
  setTextIfExists(form, ["SELL_PRICE", "sellPrice", "Text4"], data.sellPrice);
  setTextIfExists(form, ["DOWN_PAYMENT", "deposit", "Text5"], data.deposit);

  form.flatten();
  return pdf.save();
}
