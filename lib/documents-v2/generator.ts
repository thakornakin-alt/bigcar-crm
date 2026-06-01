import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import type { DocumentV2Data, DocumentV2FieldDebug } from "@/lib/documents-v2/types";

const CANDIDATE_TEMPLATE_PATHS = [
  "public/document-templates-v2/temporary-receipt.pdf",
  "public/document-templates/temporary-receipt.pdf"
];

async function loadTemplateBytes() {
  for (const rel of CANDIDATE_TEMPLATE_PATHS) {
    const p = path.join(process.cwd(), rel);
    try {
      const bytes = await readFile(p);
      return { bytes, path: rel };
    } catch {}
  }
  throw new Error("ไม่พบไฟล์ template V2: temporary-receipt.pdf");
}

export async function listTemplateFieldsV2(): Promise<{ fields: DocumentV2FieldDebug[]; templatePath: string }> {
  const { bytes, path: templatePath } = await loadTemplateBytes();
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("PDF ไม่มี AcroForm fields");
  return {
    templatePath,
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

export async function generateDocumentV2(data: DocumentV2Data): Promise<Uint8Array> {
  const { bytes } = await loadTemplateBytes();
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

