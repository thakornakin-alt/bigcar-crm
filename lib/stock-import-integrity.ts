import { readJsonStore, writeJsonStore } from "@/lib/json-store";

export type StockImportIntegrityStatus = "unknown" | "importing" | "complete" | "incomplete" | "failed";

export type StockImportIntegrity = {
  status: StockImportIntegrityStatus;
  sourceName: string;
  expectedTotal: number;
  persistedTotal: number;
  startedAt: string;
  completedAt: string;
  message: string;
};

const storeFile = "stock-import-integrity.json";

function emptyIntegrity(): StockImportIntegrity {
  return {
    status: "unknown",
    sourceName: "",
    expectedTotal: 0,
    persistedTotal: 0,
    startedAt: "",
    completedAt: "",
    message: "ยังไม่เคยตรวจยืนยันจำนวนสต๊อกปลายทาง"
  };
}

export function normalizedStockPlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export function uniqueStockPlateCount(rows: Array<{ plate?: string }>) {
  return new Set(rows.map((row) => normalizedStockPlate(String(row.plate || ""))).filter(Boolean)).size;
}

export async function readStockImportIntegrity() {
  return readJsonStore<StockImportIntegrity>(storeFile, emptyIntegrity());
}

export async function beginStockImportIntegrity(sourceName: string, expectedTotal: number) {
  const integrity: StockImportIntegrity = {
    ...emptyIntegrity(),
    status: "importing",
    sourceName,
    expectedTotal,
    startedAt: new Date().toISOString(),
    message: `กำลังนำเข้าและตรวจปลายทาง ${expectedTotal} คัน`
  };
  await writeJsonStore(storeFile, integrity);
  return integrity;
}

export async function finishStockImportIntegrity(input: {
  sourceName: string;
  expectedTotal: number;
  persistedTotal: number;
  startedAt?: string;
  error?: string;
}) {
  const completedAt = new Date().toISOString();
  const exact = input.expectedTotal === input.persistedTotal;
  const failed = Boolean(input.error);
  const integrity: StockImportIntegrity = {
    status: failed ? "failed" : exact ? "complete" : "incomplete",
    sourceName: input.sourceName,
    expectedTotal: input.expectedTotal,
    persistedTotal: input.persistedTotal,
    startedAt: input.startedAt || completedAt,
    completedAt,
    message: failed
      ? input.error || "นำเข้าสต๊อกไม่สำเร็จ"
      : exact
        ? `ตรวจปลายทางครบ ${input.persistedTotal} คัน`
        : `ข้อมูลปลายทางไม่ครบ: พบ ${input.persistedTotal} จาก ${input.expectedTotal} คัน`
  };
  await writeJsonStore(storeFile, integrity);
  return integrity;
}
