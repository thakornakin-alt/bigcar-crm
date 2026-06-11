import type { StockVehicle } from "@/lib/types";

const hiddenCharacterPattern = /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u2060\ufeff]/g;

export function sanitizeStockText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\r\n\t]+/g, " ")
    .replace(hiddenCharacterPattern, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDisplayPlate(value: unknown) {
  return sanitizeStockText(value);
}

export function normalizePlateMatchKey(value: unknown) {
  return normalizeDisplayPlate(value)
    .toUpperCase()
    .replace(/[.\-_/\\\s]+/g, "")
    .trim();
}

export function sanitizeStockVehicleTextFields<T extends Partial<StockVehicle>>(row: T): T {
  return {
    ...row,
    plate: normalizeDisplayPlate(row.plate),
    model: sanitizeStockText(row.model),
    color: sanitizeStockText(row.color),
    gear: sanitizeStockText(row.gear),
    parkingLocation: sanitizeStockText(row.parkingLocation),
    status: sanitizeStockText(row.status)
  };
}
