import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { StockVehicle } from "@/lib/types";

type StockExtraFieldsStore = {
  updatedAt: string;
  byPlate: Record<string, Record<string, string>>;
};

const stockExtraFieldsStoreName = "stock-extra-fields.json";

const knownExtraFieldKeys: Array<keyof StockVehicle> = [
  "reportReturnDate",
  "agingGroup",
  "aging",
  "customerName",
  "colorGroup",
  "closedSales",
  "inspection",
  "extendedWarranty",
  "sellerName",
  "bookingSaleDate",
  "pdiStatus",
  "engineNo",
  "financeName"
];

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function emptyStore(): StockExtraFieldsStore {
  return { updatedAt: "", byPlate: {} };
}

function collectExtraFields(vehicle: StockVehicle) {
  const output: Record<string, string> = {};

  knownExtraFieldKeys.forEach((key) => {
    const value = cleanText(vehicle[key]);
    if (value) output[String(key)] = value;
  });

  Object.entries(vehicle.extraFields || {}).forEach(([key, value]) => {
    const cleanKey = cleanText(key);
    const cleanValue = cleanText(value);
    if (cleanKey && cleanValue) output[cleanKey] = cleanValue;
  });

  return output;
}

export async function saveStockExtraFields(rows: StockVehicle[], options: { clearExisting?: boolean } = {}) {
  const store = options.clearExisting ? emptyStore() : await readJsonStore<StockExtraFieldsStore>(stockExtraFieldsStoreName, emptyStore());

  rows.forEach((row) => {
    const plate = normalizePlate(row.plate);
    if (!plate) return;
    const fields = collectExtraFields(row);
    if (!Object.keys(fields).length) return;
    store.byPlate[plate] = { ...(store.byPlate[plate] || {}), ...fields };
  });

  store.updatedAt = new Date().toISOString();
  await writeJsonStore(stockExtraFieldsStoreName, store);
}

export async function mergeStockExtraFields<T extends StockVehicle>(vehicles: T[]) {
  const store = await readJsonStore<StockExtraFieldsStore>(stockExtraFieldsStoreName, emptyStore());

  return vehicles.map((vehicle) => {
    const fields = store.byPlate[normalizePlate(vehicle.plate)] || {};
    if (!Object.keys(fields).length) return vehicle;
    const merged = { ...vehicle } as StockVehicle & Record<string, unknown>;
    Object.entries(fields).forEach(([key, value]) => {
      if (!cleanText(merged[key])) merged[key] = value;
    });
    merged.extraFields = {
      ...fields,
      ...(vehicle.extraFields || {})
    };
    return merged as T;
  });
}
