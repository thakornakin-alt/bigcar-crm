import { randomUUID } from "crypto";
import { compareAndSwapJsonStore, readJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";

export type DownloadLibraryItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
  createdBy: string;
};

export const DOCUMENT_MAX_BYTES = 3 * 1024 * 1024;
const BUCKET = "bigcar-document-library";
const STORE_KEY = "document-download-library-v1.json";
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
};

function storageConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (String(process.env.BIG_CAR_STORE_PROVIDER || "").toLowerCase() !== "supabase" || !url || !key) {
    throw new Error("กรุณาตั้งค่า Supabase สำหรับคลังเอกสาร");
  }
  return { url, key };
}

async function storageRequest(path: string, init: RequestInit = {}) {
  const { url, key } = storageConfig();
  return fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) },
    cache: "no-store"
  });
}

async function ensureBucket() {
  const check = await storageRequest(`bucket/${BUCKET}`);
  if (check.ok) return;
  if (check.status !== 404) throw new Error("ไม่สามารถตรวจสอบพื้นที่เก็บเอกสารได้");
  const created = await storageRequest("bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: DOCUMENT_MAX_BYTES,
      allowed_mime_types: Object.values(MIME_BY_EXTENSION)
    })
  });
  if (!created.ok && created.status !== 409) {
    throw new Error("ไม่สามารถสร้างพื้นที่เก็บเอกสารได้");
  }
}

export async function listDownloadLibrary() {
  const items = await readJsonStore<DownloadLibraryItem[]>(STORE_KEY, []);
  return Array.isArray(items) ? items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
}

async function mutateLibrary(transform: (items: DownloadLibraryItem[]) => DownloadLibraryItem[]) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot<DownloadLibraryItem[]>(STORE_KEY, []);
    const items = Array.isArray(snapshot.data) ? snapshot.data : [];
    const result = await compareAndSwapJsonStore(STORE_KEY, transform(items), snapshot.revision);
    if (result.updated) return;
  }
  throw new Error("มีการแก้ไขเอกสารพร้อมกัน กรุณาลองอีกครั้ง");
}

export function validateLibraryFile(fileName: string, buffer: Buffer) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new Error("รองรับเฉพาะ PDF, Word (.docx), Excel (.xlsx), JPG และ PNG");
  if (!buffer.length || buffer.length > DOCUMENT_MAX_BYTES) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 3 MB");
  const isPdf = extension === "pdf" && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isPng = extension === "png" && buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  const isJpeg = (extension === "jpg" || extension === "jpeg") && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const isZip = (extension === "docx" || extension === "xlsx") && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!isPdf && !isPng && !isJpeg && !isZip) throw new Error("ชนิดไฟล์ไม่ตรงกับนามสกุล");
  return { extension, mimeType };
}

export async function addLibraryFile(input: {
  title: string;
  category: string;
  description: string;
  fileName: string;
  bytes: Buffer;
  createdBy: string;
}) {
  const { extension, mimeType } = validateLibraryFile(input.fileName, input.bytes);
  await ensureBucket();
  const id = randomUUID();
  const storagePath = `files/${id}.${extension}`;
  const upload = await storageRequest(`object/${BUCKET}/${storagePath}`, {
    method: "POST",
    headers: { "Content-Type": mimeType, "x-upsert": "false" },
    body: new Uint8Array(input.bytes)
  });
  if (!upload.ok) throw new Error("อัปโหลดไฟล์ไปยังคลังเอกสารไม่สำเร็จ");
  const item: DownloadLibraryItem = {
    id,
    title: input.title.trim().slice(0, 120),
    category: input.category.trim().slice(0, 60) || "เอกสารทั่วไป",
    description: input.description.trim().slice(0, 300),
    fileName: input.fileName.slice(0, 180),
    mimeType,
    size: input.bytes.byteLength,
    storagePath,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy
  };
  try {
    await mutateLibrary((items) => [item, ...items]);
  } catch (error) {
    await storageRequest(`object/${BUCKET}/${storagePath}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
  return item;
}

export async function findLibraryFile(id: string) {
  return (await listDownloadLibrary()).find((item) => item.id === id) || null;
}

export async function getStoredFile(item: DownloadLibraryItem) {
  return storageRequest(`object/authenticated/${BUCKET}/${item.storagePath}`);
}

export async function removeLibraryFile(id: string) {
  const item = await findLibraryFile(id);
  if (!item) return false;
  await mutateLibrary((items) => items.filter((entry) => entry.id !== id));
  const response = await storageRequest(`object/${BUCKET}/${item.storagePath}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    console.error("[documents] orphaned private file after removing metadata", { id });
  }
  return true;
}
