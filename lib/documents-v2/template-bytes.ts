import { readFile } from "fs/promises";
import path from "path";

export function isLocalDocumentTemplatePath(templatePath: string) {
  return /^\/document-templates\/[A-Za-z0-9._-]+\.(?:pdf|jpg|jpeg|png)$/i.test(templatePath);
}

export async function loadDocumentTemplateBytes(templatePath: string, requestUrl?: string) {
  if (isLocalDocumentTemplatePath(templatePath)) {
    const normalized = path.posix.normalize(templatePath);
    if (!normalized.startsWith("/document-templates/")) {
      throw new Error(`template path out of bounds: ${templatePath}`);
    }
    const relative = normalized.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), "public", relative);
    const safeRoot = path.join(process.cwd(), "public", "document-templates") + path.sep;
    if (!filePath.toLowerCase().startsWith(safeRoot.toLowerCase())) {
      throw new Error(`template path out of bounds: ${templatePath}`);
    }
    try {
      return new Uint8Array(await readFile(filePath));
    } catch {
      throw new Error(`local template missing: ${templatePath}`);
    }
  }

  if (!requestUrl) {
    throw new Error(`external template requires request url: ${templatePath}`);
  }

  const origin = new URL(requestUrl).origin;
  const fileRes = await fetch(`${origin}${templatePath}`, { cache: "no-store" });
  if (!fileRes.ok) throw new Error(`ไม่พบไฟล์ template: ${templatePath}`);
  return new Uint8Array(await fileRes.arrayBuffer());
}
