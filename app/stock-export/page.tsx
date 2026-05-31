"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Columns3, Download, FileImage, Filter, Loader2, MessageCircle, Search } from "lucide-react";
import {
  ActiveFilterTag,
  BottomSheet,
  FilterChip,
  NativeAppHeader,
  NativeAppShell,
  NativeBadge,
  NativeButton,
  NativeCard,
  SearchField,
  StickyFilterBar,
} from "@/app/components/ui";
import type { StockVehicle } from "@/lib/types";
import type { DriveUploadResult, LineGroup } from "@/lib/types";
import { salesLineGroupStorageKey } from "@/lib/client-settings";
import { useSalesProfile } from "@/lib/use-sales-profile";
import { hasStockFieldData, realStockFieldLabels, stockRawValue } from "@/lib/stock/stock-field-aliases";

type StockListResponse = {
  vehicles: StockVehicle[];
  total: number;
  warning?: string;
};

const maxTableItems = 20;
const stockStatuses = ["รอขาย", "เตรียมส่งลาน", "จอง_Sale", "จอง_Internal", "จอง_รถทดแทน", "ขายแล้ว"];
const ENABLE_NEW_STOCK_UI = process.env.NEXT_PUBLIC_ENABLE_NEW_STOCK_UI !== "false";

type ExportMode = "customer" | "internal";
type ExportFormat = "png" | "jpeg" | "pdf";
type PdiRemarkFilter = "all" | "none" | "has";

type StockExportGroup = {
  name: string;
  pages: StockVehicle[][];
  vehicles: StockVehicle[];
};

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type StockExportFileBundle = {
  files: File[];
  pageCount: number;
  groupCount: number;
  vehicleCount: number;
};

type StockExportContact = {
  name: string;
  phone: string;
  lineId: string;
  avatarImage: HTMLImageElement | null;
  lineQrImage: HTMLImageElement | null;
};

type AdvancedStockFilters = {
  models: string[];
  years: string[];
  registrationYears: string[];
  reportReturnFrom: string;
  reportReturnTo: string;
  bookingSaleFrom: string;
  bookingSaleTo: string;
  colors: string[];
  colorGroups: string[];
  gears: string[];
  statuses: string[];
  ownerships: string[];
  projects: string[];
  campaigns: string[];
  agingGroups: string[];
  agings: string[];
  closedSales: string[];
  inspections: string[];
  extendedWarranties: string[];
  pdiStatuses: string[];
  pdiNotes: string[];
  financeNames: string[];
  locations: string[];
  vehicleGroups: string[];
  customerName: string;
  sellerName: string;
  plate: string;
  vin: string;
  engineNo: string;
  mileageBands: string[];
  mileageMin: string;
  mileageMax: string;
  priceMin: string;
  priceMax: string;
  agingMin: string;
  agingMax: string;
  customValues: Record<string, string[]>;
};

const emptyAdvancedFilters: AdvancedStockFilters = {
  models: [],
  years: [],
  registrationYears: [],
  reportReturnFrom: "",
  reportReturnTo: "",
  bookingSaleFrom: "",
  bookingSaleTo: "",
  colors: [],
  colorGroups: [],
  gears: [],
  statuses: [],
  ownerships: [],
  projects: [],
  campaigns: [],
  agingGroups: [],
  agings: [],
  closedSales: [],
  inspections: [],
  extendedWarranties: [],
  pdiStatuses: [],
  pdiNotes: [],
  financeNames: [],
  locations: [],
  vehicleGroups: [],
  customerName: "",
  sellerName: "",
  plate: "",
  vin: "",
  engineNo: "",
  mileageBands: [],
  mileageMin: "",
  mileageMax: "",
  priceMin: "",
  priceMax: "",
  agingMin: "",
  agingMax: "",
  customValues: {}
};

type SortField = "location" | "ownership" | "reportReturnDate" | "agingGroup" | "aging" | "customerName" | "vehicleGroup" | "plate" | "colorGroup" | "project" | "campaign" | "closedSales" | "inspection" | "extendedWarranty" | "status" | "sellerName" | "bookingSaleDate" | "year" | "model" | "gear" | "color" | "mileage" | "price" | "pdiStatus" | "pdiNote" | "vin" | "engineNo" | "financeName" | `custom:${string}`;
type SortDirection = "asc" | "desc";
type SortRule = { id: string; field: SortField; direction: SortDirection };
type BaseExtraColumnKey = "ownership" | "reportReturnDate" | "agingGroup" | "aging" | "customerName" | "vehicleGroup" | "colorGroup" | "project" | "campaign" | "closedSales" | "inspection" | "extendedWarranty" | "status" | "sellerName" | "bookingSaleDate" | "pdiStatus" | "pdiNote" | "vin" | "engineNo" | "financeName";
type ExtraColumnKey = BaseExtraColumnKey | `custom:${string}`;
type FilterPreset = { id: string; name: string; filters: AdvancedStockFilters; statuses: string[]; groups: string[]; pdi: PdiRemarkFilter; sorts: SortRule[]; columns: ExtraColumnKey[] };

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function formatPrice(value: string) {
  const numeric = Number(String(value || "").replace(/[^\d.]/g, ""));
  if (!numeric) return "-";
  return `${numeric.toLocaleString("th-TH")} บาท`;
}

function formatMileage(value?: string) {
  const numeric = Number(String(value || "").replace(/[^\d.]/g, ""));
  if (!numeric) return "-";
  return `${numeric.toLocaleString("th-TH")} กม.`;
}

function parseNumeric(value?: string) {
  return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
}

function parseYearSafely(value?: unknown, preferBuddhist = false) {
  if (value === null || value === undefined) return "";
  const toDisplay = (year: number) => {
    const adYear = year >= 2400 ? year - 543 : year;
    if (adYear < 1990 || adYear > 2100) return "";
    return String(preferBuddhist ? adYear + 543 : adYear);
  };

  if (Object.prototype.toString.call(value) === "[object Date]") {
    const year = (value as Date).getFullYear();
    return toDisplay(year);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const direct = raw.match(/\b(19|20|25)\d{2}\b/);
  if (direct) return toDisplay(Number(direct[0]));

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) {
    if (asNumber > 30000 && asNumber < 100000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const asDate = new Date(excelEpoch.getTime() + asNumber * 86400000);
      return toDisplay(asDate.getUTCFullYear());
    }
    if (asNumber > 1000000 && asNumber < 9999999999) {
      const ms = asNumber < 10000000000 ? asNumber * 1000 : asNumber;
      const dt = new Date(ms);
      if (!Number.isNaN(dt.getTime())) return toDisplay(dt.getUTCFullYear());
    }
  }

  const dateLikeMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-]((19|20|25)\d{2})\b/);
  if (dateLikeMatch) return toDisplay(Number(dateLikeMatch[3]));

  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 4) {
    const yearMatch = digits.match(/(19|20|25)\d{2}/);
    if (yearMatch) return toDisplay(Number(yearMatch[0]));
  }
  return "";
}

function isValidGregorianYearText(value?: string) {
  const text = String(value || "").trim();
  if (!/^\d{4}$/.test(text)) return false;
  const year = Number(text);
  return year >= 1990 && year <= 2100;
}

function stockRegistrationYear(vehicle: StockVehicle) {
  const raw = rawVehicleValue(vehicle, ["registrationYear", "registeredYear", "ปีจด", "ปีจดทะเบียน", "ทะเบียนปี"]);
  const year = parseYearSafely(raw, false);
  return isValidGregorianYearText(year) ? year : "";
}

function rawVehicleValue(vehicle: StockVehicle, keys: string[]) {
  const raw = vehicle as StockVehicle & Record<string, unknown>;
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function productionYear(vehicle: StockVehicle) {
  return rawVehicleValue(vehicle, ["productionYear", "ผลิต", "ปีผลิต", "ManufactureYear", "MfgYear"]);
}

function engineNo(vehicle: StockVehicle) {
  return rawVehicleValue(vehicle, ["engineNo", "เลขเครื่อง", "EngineNo", "EngineNumber"]);
}

function financeName(vehicle: StockVehicle) {
  return rawVehicleValue(vehicle, ["finance", "ไฟแนนซ์", "บริษัทไฟแนนซ์", "Finance"]);
}

function importedAt(vehicle: StockVehicle) {
  return rawVehicleValue(vehicle, ["importedAt", "ImportedAt", "วันที่รถเข้า", "วันที่อัปโหลด", "createdAt"]);
}

function updatedAt(vehicle: StockVehicle) {
  return rawVehicleValue(vehicle, ["updatedAt", "UpdatedAt", "วันที่อัปเดตล่าสุด"]);
}

function dateValue(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function vehicleTitle(vehicle: StockVehicle) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "-";
}

function stockStatus(vehicle: StockVehicle) {
  return String(vehicle.status || "").trim();
}

function stockVehicleGroup(vehicle: StockVehicle) {
  return String(vehicle.vehicleGroup || "").trim();
}

function cleanPdiRemark(value?: string) {
  return String(value ?? "").trim();
}

function pdiNoteFromVehicle(vehicle: StockVehicle) {
  const raw = vehicle as StockVehicle & Record<string, unknown>;
  const keys = ["pdiNote", "PdiNote", "PDINote", "pdi", "PDI", "pdi_note", "pdiRemark", "remark", "note", "หมายเหตุ PDI", "หมายเหตุPDI", "หมายเหตุ"];
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && cleanPdiRemark(String(value))) return cleanPdiRemark(String(value));
  }
  return "";
}

function hasPdiRemark(value?: string) {
  const remark = cleanPdiRemark(value).replace(/\s+/g, "");
  return Boolean(remark && remark !== "-" && remark !== "–" && remark !== "—");
}

function stockPdiRemark(vehicle: StockVehicle) {
  return pdiNoteFromVehicle(vehicle);
}

function matchesPdiRemarkFilter(vehicle: StockVehicle, filter: PdiRemarkFilter) {
  if (filter === "all") return true;
  const hasRemark = hasPdiRemark(stockPdiRemark(vehicle));
  return filter === "has" ? hasRemark : !hasRemark;
}

function pdiRemarkText(value?: string) {
  return hasPdiRemark(value) ? cleanPdiRemark(value) : "-";
}

function shortLocation(value?: string) {
  return String(value || "-")
    .replace("โกดัง-", "")
    .replace("สาขา", "")
    .trim() || "-";
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));
}

const mileageBandOptions = [
  { label: "0-30,000", min: 0, max: 30000 },
  { label: "30,000-60,000", min: 30000, max: 60000 },
  { label: "60,000-100,000", min: 60000, max: 100000 },
  { label: "100,000+", min: 100000, max: Number.POSITIVE_INFINITY }
];

function matchesMileageBand(mileage: number, bandLabel: string) {
  const band = mileageBandOptions.find((item) => item.label === bandLabel);
  if (!band) {
    const exact = parseNumeric(bandLabel);
    return exact ? mileage === exact : true;
  }
  if (band.max === Number.POSITIVE_INFINITY) return mileage >= band.min;
  return mileage >= band.min && mileage <= band.max;
}

function countAdvancedFilters(filters: AdvancedStockFilters) {
  return Object.values(filters).reduce((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    if (value && typeof value === "object") return count + Object.values(value).reduce((sum, item) => sum + (Array.isArray(item) ? item.length : 0), 0);
    return count + (String(value || "").trim() ? 1 : 0);
  }, 0);
}

function matchesAdvancedFilters(vehicle: StockVehicle, filters: AdvancedStockFilters) {
  return matchesAdvancedFiltersExcept(vehicle, filters, []);
}

function matchesAdvancedFiltersExcept(vehicle: StockVehicle, filters: AdvancedStockFilters, except: (keyof AdvancedStockFilters)[]) {
  const ignored = new Set<keyof AdvancedStockFilters>(except);
  if (!ignored.has("models") && filters.models.length && !filters.models.includes(vehicleTitle(vehicle))) return false;
  if (!ignored.has("registrationYears") && filters.registrationYears.length && !filters.registrationYears.includes(stockRegistrationYear(vehicle))) return false;
  if (!ignored.has("colors") && filters.colors.length && !filters.colors.includes(vehicle.color || "")) return false;
  if (!ignored.has("colorGroups") && filters.colorGroups.length && !filters.colorGroups.includes(stockRawValue(vehicle, "colorGroup"))) return false;
  if (!ignored.has("gears") && filters.gears.length && !filters.gears.includes(vehicle.gear || "")) return false;
  if (!ignored.has("statuses") && filters.statuses.length && !filters.statuses.includes(stockStatus(vehicle))) return false;
  if (!ignored.has("ownerships") && filters.ownerships.length && !filters.ownerships.includes(vehicle.ownership || "")) return false;
  if (!ignored.has("projects") && filters.projects.length && !filters.projects.includes(vehicle.project || "")) return false;
  if (!ignored.has("campaigns") && filters.campaigns.length && !filters.campaigns.includes(vehicle.campaign || "")) return false;
  if (!ignored.has("agingGroups") && filters.agingGroups.length && !filters.agingGroups.includes(stockRawValue(vehicle, "agingGroup"))) return false;
  if (!ignored.has("agings") && filters.agings.length && !filters.agings.includes(stockRawValue(vehicle, "aging"))) return false;
  if (!ignored.has("closedSales") && filters.closedSales.length && !filters.closedSales.includes(stockRawValue(vehicle, "closedSales"))) return false;
  if (!ignored.has("inspections") && filters.inspections.length && !filters.inspections.includes(stockRawValue(vehicle, "inspection"))) return false;
  if (!ignored.has("extendedWarranties") && filters.extendedWarranties.length && !filters.extendedWarranties.includes(stockRawValue(vehicle, "extendedWarranty"))) return false;
  if (!ignored.has("pdiStatuses") && filters.pdiStatuses.length && !filters.pdiStatuses.includes(stockRawValue(vehicle, "pdiStatus"))) return false;
  if (!ignored.has("pdiNotes") && filters.pdiNotes.length && !filters.pdiNotes.includes(pdiRemarkText(stockPdiRemark(vehicle)))) return false;
  if (!ignored.has("financeNames") && filters.financeNames.length && !filters.financeNames.includes(financeName(vehicle))) return false;
  if (!ignored.has("locations") && filters.locations.length && !filters.locations.includes(vehicle.parkingLocation || "")) return false;
  if (!ignored.has("vehicleGroups") && filters.vehicleGroups.length && !filters.vehicleGroups.includes(stockVehicleGroup(vehicle) || "")) return false;
  if (!ignored.has("customerName") && filters.customerName && !normalizeText(stockRawValue(vehicle, "customerName")).includes(normalizeText(filters.customerName))) return false;
  if (!ignored.has("sellerName") && filters.sellerName && !normalizeText(stockRawValue(vehicle, "sellerName")).includes(normalizeText(filters.sellerName))) return false;
  if (!ignored.has("plate") && filters.plate && !normalizePlate(vehicle.plate).includes(normalizePlate(filters.plate))) return false;
  if (!ignored.has("vin") && filters.vin && !normalizeText(vehicle.vin || "").includes(normalizeText(filters.vin))) return false;
  if (!ignored.has("engineNo") && filters.engineNo && !normalizeText(engineNo(vehicle)).includes(normalizeText(filters.engineNo))) return false;

  const mileage = parseNumeric(vehicle.mileage);
  if (!ignored.has("mileageBands") && filters.mileageBands.length && !filters.mileageBands.some((band) => matchesMileageBand(mileage, band))) return false;
  const mileageMin = parseNumeric(filters.mileageMin);
  const mileageMax = parseNumeric(filters.mileageMax);
  if (!ignored.has("mileageMin") && mileageMin && mileage < mileageMin) return false;
  if (!ignored.has("mileageMax") && mileageMax && mileage > mileageMax) return false;

  const price = parseNumeric(vehicle.salePrice);
  const priceMin = parseNumeric(filters.priceMin);
  const priceMax = parseNumeric(filters.priceMax);
  if (!ignored.has("priceMin") && priceMin && price < priceMin) return false;
  if (!ignored.has("priceMax") && priceMax && price > priceMax) return false;

  const aging = parseNumeric(stockRawValue(vehicle, "aging"));
  const agingMin = parseNumeric(filters.agingMin);
  const agingMax = parseNumeric(filters.agingMax);
  if (!ignored.has("agingMin") && agingMin && aging < agingMin) return false;
  if (!ignored.has("agingMax") && agingMax && aging > agingMax) return false;

  const reportReturn = dateValue(stockRawValue(vehicle, "reportReturnDate"));
  const reportReturnFrom = dateValue(filters.reportReturnFrom);
  const reportReturnTo = dateValue(filters.reportReturnTo);
  if (!ignored.has("reportReturnFrom") && reportReturnFrom && reportReturn && reportReturn < reportReturnFrom) return false;
  if (!ignored.has("reportReturnTo") && reportReturnTo && reportReturn && reportReturn > reportReturnTo + 86400000 - 1) return false;

  const bookingSale = dateValue(stockRawValue(vehicle, "bookingSaleDate"));
  const bookingSaleFrom = dateValue(filters.bookingSaleFrom);
  const bookingSaleTo = dateValue(filters.bookingSaleTo);
  if (!ignored.has("bookingSaleFrom") && bookingSaleFrom && bookingSale && bookingSale < bookingSaleFrom) return false;
  if (!ignored.has("bookingSaleTo") && bookingSaleTo && bookingSale && bookingSale > bookingSaleTo + 86400000 - 1) return false;

  if (!ignored.has("customValues")) {
    for (const [field, values] of Object.entries(filters.customValues || {})) {
      if (values.length && !values.includes(defaultColumnValue(vehicle, `custom:${field}`))) return false;
    }
  }

  return true;
}

function sortVehicleValue(vehicle: StockVehicle, field: SortField) {
  if (field === "location") return stockRawValue(vehicle, "location");
  if (field === "ownership") return stockRawValue(vehicle, "ownership");
  if (field === "reportReturnDate") return dateValue(stockRawValue(vehicle, "reportReturnDate"));
  if (field === "agingGroup") return stockRawValue(vehicle, "agingGroup");
  if (field === "aging") return Number(stockRawValue(vehicle, "aging") || 0);
  if (field === "customerName") return stockRawValue(vehicle, "customerName");
  if (field === "vehicleGroup") return stockRawValue(vehicle, "vehicleGroup");
  if (field === "plate") return stockRawValue(vehicle, "plate");
  if (field === "colorGroup") return stockRawValue(vehicle, "colorGroup");
  if (field === "project") return stockRawValue(vehicle, "project");
  if (field === "campaign") return stockRawValue(vehicle, "campaign");
  if (field === "closedSales") return stockRawValue(vehicle, "closedSales");
  if (field === "inspection") return stockRawValue(vehicle, "inspection");
  if (field === "extendedWarranty") return stockRawValue(vehicle, "extendedWarranty");
  if (field === "sellerName") return stockRawValue(vehicle, "sellerName");
  if (field === "bookingSaleDate") return dateValue(stockRawValue(vehicle, "bookingSaleDate"));
  if (field === "model") return vehicleTitle(vehicle);
  if (field === "year") return Number(stockRegistrationYear(vehicle) || 0);
  if (field === "price") return parseNumeric(vehicle.salePrice);
  if (field === "mileage") return parseNumeric(vehicle.mileage);
  if (field === "status") return stockStatus(vehicle);
  if (field === "gear") return stockRawValue(vehicle, "gear");
  if (field === "color") return stockRawValue(vehicle, "color");
  if (field === "pdiStatus") return stockRawValue(vehicle, "pdiStatus");
  if (field === "pdiNote") return stockRawValue(vehicle, "pdiNote");
  if (field === "vin") return vehicle.vin || "";
  if (field === "engineNo") return engineNo(vehicle);
  if (field === "financeName") return financeName(vehicle);
  if (field.startsWith("custom:")) return defaultColumnValue(vehicle, field);
  return "";
}

function sortVehicles(vehicles: StockVehicle[], rules: SortRule[]) {
  if (!rules.length) return vehicles;
  return [...vehicles].sort((a, b) => {
    for (const rule of rules) {
      const av = sortVehicleValue(a, rule.field);
      const bv = sortVehicleValue(b, rule.field);
      const direction = rule.direction === "desc" ? -1 : 1;
      const result = typeof av === "number" || typeof bv === "number"
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av).localeCompare(String(bv), "th", { numeric: true });
      if (result !== 0) return result * direction;
    }
    return 0;
  });
}

function customExtraColumnName(key: ExtraColumnKey) {
  return key.startsWith("custom:") ? key.slice("custom:".length) : "";
}

function defaultColumnValue(vehicle: StockVehicle, key: ExtraColumnKey) {
  const customName = customExtraColumnName(key);
  if (customName) {
    const raw = vehicle as StockVehicle & Record<string, unknown>;
    return String(vehicle.extraFields?.[customName] || raw[customName] || "-");
  }
  if (key === "vin") return vehicle.vin || "-";
  if (key === "engineNo") return engineNo(vehicle) || "-";
  if (key === "financeName") return financeName(vehicle) || "-";
  if (key === "pdiNote") return pdiRemarkText(stockPdiRemark(vehicle));
  return stockRawValue(vehicle, key as BaseExtraColumnKey) || "-";
}

function normalizeAdvancedFilters(value: Partial<AdvancedStockFilters> | null | undefined): AdvancedStockFilters {
  const arrayKeys: Array<keyof AdvancedStockFilters> = [
    "models",
    "years",
    "colors",
    "colorGroups",
    "gears",
    "statuses",
    "ownerships",
    "projects",
    "campaigns",
    "agingGroups",
    "agings",
    "closedSales",
    "inspections",
    "extendedWarranties",
    "pdiStatuses",
    "pdiNotes",
    "financeNames",
    "locations",
    "vehicleGroups",
    "mileageBands"
  ];
  const next = { ...emptyAdvancedFilters, ...(value || {}) };
  arrayKeys.forEach((key) => {
    const current = next[key];
    (next as Record<string, unknown>)[key] = Array.isArray(current) ? current.filter(Boolean) : current ? [String(current)] : [];
  });
  next.customValues = Object.entries(next.customValues || {}).reduce<Record<string, string[]>>((mapped, [key, values]) => {
    mapped[key] = Array.isArray(values) ? values.filter(Boolean) : [];
    return mapped;
  }, {});
  return next;
}

const sortFieldLabels: Record<string, string> = {
  location: realStockFieldLabels.location,
  ownership: realStockFieldLabels.ownership,
  reportReturnDate: realStockFieldLabels.reportReturnDate,
  agingGroup: realStockFieldLabels.agingGroup,
  aging: realStockFieldLabels.aging,
  customerName: realStockFieldLabels.customerName,
  vehicleGroup: realStockFieldLabels.vehicleGroup,
  plate: realStockFieldLabels.plate,
  colorGroup: realStockFieldLabels.colorGroup,
  project: realStockFieldLabels.project,
  campaign: realStockFieldLabels.campaign,
  closedSales: realStockFieldLabels.closedSales,
  inspection: realStockFieldLabels.inspection,
  extendedWarranty: realStockFieldLabels.extendedWarranty,
  status: realStockFieldLabels.status,
  sellerName: realStockFieldLabels.sellerName,
  bookingSaleDate: realStockFieldLabels.bookingSaleDate,
  year: realStockFieldLabels.year,
  model: realStockFieldLabels.model,
  gear: realStockFieldLabels.gear,
  color: realStockFieldLabels.color,
  mileage: realStockFieldLabels.mileage,
  price: realStockFieldLabels.salePrice,
  pdiStatus: realStockFieldLabels.pdiStatus,
  pdiNote: realStockFieldLabels.pdiNote,
  vin: realStockFieldLabels.vin,
  engineNo: realStockFieldLabels.engineNo,
  financeName: realStockFieldLabels.financeName
};

function sortFieldLabel(field: SortField) {
  return sortFieldLabels[field] || extraColumnLabel(field as ExtraColumnKey) || String(field);
}

const extraColumnLabels: Record<BaseExtraColumnKey, string> = {
  ownership: realStockFieldLabels.ownership,
  reportReturnDate: realStockFieldLabels.reportReturnDate,
  agingGroup: realStockFieldLabels.agingGroup,
  aging: realStockFieldLabels.aging,
  customerName: realStockFieldLabels.customerName,
  vehicleGroup: realStockFieldLabels.vehicleGroup,
  colorGroup: realStockFieldLabels.colorGroup,
  project: realStockFieldLabels.project,
  campaign: realStockFieldLabels.campaign,
  closedSales: realStockFieldLabels.closedSales,
  inspection: realStockFieldLabels.inspection,
  extendedWarranty: realStockFieldLabels.extendedWarranty,
  status: realStockFieldLabels.status,
  sellerName: realStockFieldLabels.sellerName,
  bookingSaleDate: realStockFieldLabels.bookingSaleDate,
  pdiStatus: realStockFieldLabels.pdiStatus,
  pdiNote: realStockFieldLabels.pdiNote,
  vin: realStockFieldLabels.vin,
  engineNo: realStockFieldLabels.engineNo,
  financeName: realStockFieldLabels.financeName
};

function extraColumnLabel(key: ExtraColumnKey) {
  const customName = customExtraColumnName(key);
  if (customName) return customName;
  return extraColumnLabels[key as BaseExtraColumnKey];
}

type StockExportColumn = { key: string; label: string; width: number; extraKey?: ExtraColumnKey };

function stockExportExtraColumns(mode: ExportMode, selectedColumns: ExtraColumnKey[]) {
  const baseIncluded = new Set<ExtraColumnKey>(["vehicleGroup"]);
  if (mode === "internal") baseIncluded.add("pdiNote");
  return selectedColumns.filter((key) => {
    if (baseIncluded.has(key)) return false;
    if (mode === "customer" && key === "pdiNote") return false;
    return true;
  });
}

function extraColumnExportWidth(key: ExtraColumnKey) {
  if (customExtraColumnName(key)) return 190;
  if (key === "vin") return 260;
  if (key === "engineNo") return 220;
  if (key === "customerName" || key === "sellerName") return 220;
  if (key === "reportReturnDate" || key === "bookingSaleDate") return 180;
  if (key === "closedSales" || key === "extendedWarranty") return 180;
  return 160;
}

function stockExportColumns(mode: ExportMode, selectedColumns: ExtraColumnKey[], hasRegistrationYear: boolean): StockExportColumn[] {
  const columns: StockExportColumn[] =
    mode === "internal"
      ? [
          { key: "location", label: "Location", width: 120 },
          { key: "plate", label: "ทะเบียน", width: 130 },
          ...(hasRegistrationYear ? [{ key: "registrationYear", label: "ปีจด", width: 82 }] : []),
          { key: "model", label: "รุ่นรถยนต์", width: 370 },
          { key: "gear", label: "เกียร์", width: 70 },
          { key: "color", label: "สี", width: 110 },
          { key: "mileage", label: "เลขไมล์", width: 120 },
          { key: "price", label: "ราคาเสนอขายRT", width: 160 },
          { key: "pdi", label: "หมายเหตุ PDI", width: 550 }
        ]
      : [
          { key: "location", label: "Location", width: 165 },
          { key: "plate", label: "ทะเบียน", width: 150 },
          ...(hasRegistrationYear ? [{ key: "registrationYear", label: "ปีจด", width: 120 }] : []),
          { key: "model", label: "รุ่นรถยนต์", width: 620 },
          { key: "gear", label: "เกียร์", width: 95 },
          { key: "color", label: "สี", width: 190 },
          { key: "mileage", label: "เลขไมล์", width: 170 },
          { key: "price", label: "ราคาเสนอขายRT", width: 202 }
        ];

  stockExportExtraColumns(mode, selectedColumns).forEach((key) => {
    columns.push({ key: `extra:${key}`, label: extraColumnLabel(key), width: extraColumnExportWidth(key), extraKey: key });
  });

  return columns;
}

function safeFilePart(value: string) {
  return String(value || "stock")
    .replace(/[\\/:*?"<>|#\[\]]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "stock";
}

function fileName(groupName: string, extension: "png" | "jpg", page?: number, totalPages?: number) {
  const date = new Date().toISOString().slice(0, 10);
  const group = safeFilePart(groupName);
  if (page && totalPages && totalPages > 1) return `big-car-stock-${group}-${date}-page-${page}-of-${totalPages}.${extension}`;
  return `big-car-stock-${group}-${date}.${extension}`;
}

function pdfFileName(groupCount: number) {
  const date = new Date().toISOString().slice(0, 10);
  return `big-car-stock-${groupCount.toLocaleString("en-US")}-groups-${date}.pdf`;
}

function senderName(user: { firstName: string; lastName: string; nickname: string; phone: string } | null) {
  if (!user) return "BIG CAR CRM";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return [user.nickname || fullName, user.phone].filter(Boolean).join(" · ") || "BIG CAR CRM";
}

async function stockExportContactProfile(user: {
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  lineId: string;
  avatarUrl: string;
  lineQrUrl: string;
} | null): Promise<StockExportContact | null> {
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const [avatarImage, lineQrImage] = await Promise.all([
    loadStockCanvasImage(user.avatarUrl || "/logo-rdd.png").catch(() => null),
    user.lineQrUrl ? loadStockCanvasImage(user.lineQrUrl).catch(() => null) : Promise.resolve(null)
  ]);
  return {
    name: user.nickname || fullName || "เซลล์",
    phone: user.phone || "",
    lineId: user.lineId || "",
    avatarImage,
    lineQrImage
  };
}

export default function StockExportPage() {
  const { user: salesProfile } = useSalesProfile();
  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [selectedLineGroupId, setSelectedLineGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedVehicleGroups, setSelectedVehicleGroups] = useState<string[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedStockFilters>(emptyAdvancedFilters);
  const [pdiRemarkFilter, setPdiRemarkFilter] = useState<PdiRemarkFilter>("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [extraColumns, setExtraColumns] = useState<ExtraColumnKey[]>([]);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [exportMode, setExportMode] = useState<ExportMode>("customer");
  const [listOpen, setListOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sendingLine, setSendingLine] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const importedStatusCount = useMemo(() => vehicles.filter((vehicle) => stockStatus(vehicle)).length, [vehicles]);
  const importedVehicleGroupCount = useMemo(() => vehicles.filter((vehicle) => stockVehicleGroup(vehicle)).length, [vehicles]);
  const importedPdiNoteCount = useMemo(() => vehicles.filter((vehicle) => hasPdiRemark(stockPdiRemark(vehicle))).length, [vehicles]);

  const plateMatchedVehicles = useMemo(() => {
    const search = query.toLowerCase().replace(/\s+/g, "");
    const byPlate = new Map<string, StockVehicle>();

    vehicles.forEach((vehicle) => {
      const plateKey = normalizePlate(vehicle.plate);
      if (!plateKey || byPlate.has(plateKey)) return;
      if (search) {
        const hay = [
          vehicle.plate,
          vehicle.brand,
          vehicle.model,
          stockRegistrationYear(vehicle),
          vehicle.color,
          vehicle.status,
          vehicle.gear,
          vehicle.mileage,
          vehicle.salePrice,
          vehicle.parkingLocation,
          vehicle.project,
          vehicle.program,
          vehicle.vehicleGroup
        ]
          .join("")
          .toLowerCase()
          .replace(/\s+/g, "");
        if (!hay.includes(search)) return;
      }
      byPlate.set(plateKey, vehicle);
    });

    return Array.from(byPlate.values());
  }, [query, vehicles]);

  const statusMatchedVehicles = useMemo(() => {
    return plateMatchedVehicles.filter((vehicle) => {
      const status = stockStatus(vehicle);
      return !selectedStatuses.length || !importedStatusCount || selectedStatuses.includes(status);
    });
  }, [importedStatusCount, plateMatchedVehicles, selectedStatuses]);

  const groupMatchedVehicles = useMemo(() => {
    return statusMatchedVehicles.filter((vehicle) => {
      const group = stockVehicleGroup(vehicle) || "ไม่ระบุ";
      return !selectedVehicleGroups.length || selectedVehicleGroups.includes(group);
    });
  }, [selectedVehicleGroups, statusMatchedVehicles]);

  const advancedMatchedVehicles = useMemo(() => {
    return groupMatchedVehicles.filter((vehicle) => matchesAdvancedFilters(vehicle, advancedFilters));
  }, [advancedFilters, groupMatchedVehicles]);

  const filteredVehicles = useMemo(() => {
    return advancedMatchedVehicles.filter((vehicle) => matchesPdiRemarkFilter(vehicle, pdiRemarkFilter));
  }, [advancedMatchedVehicles, pdiRemarkFilter]);

  const sortedVehicles = useMemo(() => sortVehicles(filteredVehicles, sortRules), [filteredVehicles, sortRules]);

  const advancedOptions = useMemo(() => {
    const optionValues = (except: (keyof AdvancedStockFilters)[]) => {
      return groupMatchedVehicles.filter((vehicle) => matchesAdvancedFiltersExcept(vehicle, advancedFilters, except));
    };

    return {
      models: uniqueSorted(optionValues(["models"]).map((vehicle) => vehicleTitle(vehicle))),
      years: [],
      registrationYears: uniqueSorted(optionValues(["registrationYears"]).map((vehicle) => stockRegistrationYear(vehicle)).filter((value) => isValidGregorianYearText(value))).sort((a, b) => Number(b) - Number(a)),
      colors: uniqueSorted(optionValues(["colors"]).map((vehicle) => vehicle.color || "")),
      colorGroups: uniqueSorted(optionValues(["colorGroups"]).map((vehicle) => stockRawValue(vehicle, "colorGroup"))),
      gears: uniqueSorted(optionValues(["gears"]).map((vehicle) => vehicle.gear || "")),
      statuses: uniqueSorted(optionValues(["statuses"]).map((vehicle) => stockStatus(vehicle))),
      ownerships: uniqueSorted(optionValues(["ownerships"]).map((vehicle) => vehicle.ownership || "")),
      projects: uniqueSorted(optionValues(["projects"]).map((vehicle) => vehicle.project || "")),
      campaigns: uniqueSorted(optionValues(["campaigns"]).map((vehicle) => vehicle.campaign || "")),
      agingGroups: uniqueSorted(optionValues(["agingGroups"]).map((vehicle) => stockRawValue(vehicle, "agingGroup"))),
      agings: uniqueSorted(optionValues(["agings"]).map((vehicle) => stockRawValue(vehicle, "aging"))),
      closedSales: uniqueSorted(optionValues(["closedSales"]).map((vehicle) => stockRawValue(vehicle, "closedSales"))),
      inspections: uniqueSorted(optionValues(["inspections"]).map((vehicle) => stockRawValue(vehicle, "inspection"))),
      extendedWarranties: uniqueSorted(optionValues(["extendedWarranties"]).map((vehicle) => stockRawValue(vehicle, "extendedWarranty"))),
      pdiStatuses: uniqueSorted(optionValues(["pdiStatuses"]).map((vehicle) => stockRawValue(vehicle, "pdiStatus"))),
      pdiNotes: uniqueSorted(optionValues(["pdiNotes"]).map((vehicle) => pdiRemarkText(stockPdiRemark(vehicle))).filter((value) => value !== "-")),
      financeNames: uniqueSorted(optionValues(["financeNames"]).map((vehicle) => financeName(vehicle))),
      locations: uniqueSorted(optionValues(["locations"]).map((vehicle) => vehicle.parkingLocation || "")),
      vehicleGroups: uniqueSorted(optionValues(["vehicleGroups"]).map((vehicle) => stockVehicleGroup(vehicle) || ""))
    };
  }, [advancedFilters, groupMatchedVehicles]);

  const customFieldOptions = useMemo(() => {
    return extraColumns.reduce<Record<string, string[]>>((options, key) => {
      const customName = customExtraColumnName(key);
      if (!customName) return options;
      options[customName] = uniqueSorted(groupMatchedVehicles.map((vehicle) => defaultColumnValue(vehicle, key)).filter((value) => value !== "-"));
      return options;
    }, {});
  }, [extraColumns, groupMatchedVehicles]);

  const availableExtraColumns = useMemo(() => {
    const keys = Object.keys(extraColumnLabels) as BaseExtraColumnKey[];
    const fixedColumns = keys.filter((key) => {
      if (key === "pdiNote") return exportMode === "internal" && vehicles.some((vehicle) => hasPdiRemark(stockPdiRemark(vehicle)));
      if (key === "vin") return hasStockFieldData(vehicles, "vin");
      if (key === "engineNo") return hasStockFieldData(vehicles, "engineNo");
      if (key === "financeName") return hasStockFieldData(vehicles, "financeName");
      return hasStockFieldData(vehicles, key);
    });

    const knownLabels = new Set(Object.values(extraColumnLabels).map((label) => normalizeText(label)));
    const customColumns = uniqueSorted(
      vehicles.flatMap((vehicle) =>
        Object.entries(vehicle.extraFields || {})
          .filter(([key, value]) => key && String(value || "").trim() && !knownLabels.has(normalizeText(key)))
          .map(([key]) => key)
      )
    ).map((key) => `custom:${key}` as ExtraColumnKey);

    return [...fixedColumns, ...customColumns];
  }, [exportMode, vehicles]);

  const advancedFilterCount = useMemo(() => countAdvancedFilters(advancedFilters), [advancedFilters]);

  const pdiRemarkCounts = useMemo(() => {
    return advancedMatchedVehicles.reduce(
      (counts, vehicle) => {
        if (hasPdiRemark(stockPdiRemark(vehicle))) counts.has += 1;
        else counts.none += 1;
        counts.all += 1;
        return counts;
      },
      { all: 0, none: 0, has: 0 }
    );
  }, [advancedMatchedVehicles]);

  const statusCounts = useMemo(() => {
    return plateMatchedVehicles.reduce<Record<string, number>>((counts, vehicle) => {
      const status = stockStatus(vehicle) || "ไม่ระบุ";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }, [plateMatchedVehicles]);

  const statusOptions = useMemo(() => {
    return stockStatuses.filter((status) => (statusCounts[status] || 0) > 0 || selectedStatuses.includes(status));
  }, [selectedStatuses, statusCounts]);

  const vehicleGroupOptions = useMemo(() => {
    const counts = statusMatchedVehicles.reduce<Record<string, number>>((nextCounts, vehicle) => {
      const group = stockVehicleGroup(vehicle);
      if (group) nextCounts[group] = (nextCounts[group] || 0) + 1;
      return nextCounts;
    }, {});

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [statusMatchedVehicles]);

  const exportVehicles = sortedVehicles;
  const exportGroups = useMemo(() => groupVehiclesForExport(exportVehicles), [exportVehicles]);
  const exportPageCount = useMemo(() => exportGroups.reduce((total, group) => total + group.pages.length, 0), [exportGroups]);
  const visibleVehicles = useMemo(() => sortedVehicles.slice(0, visibleCount), [sortedVehicles, visibleCount]);
  const pdiRemarkVehicles = useMemo(
    () => sortedVehicles.filter((vehicle) => hasPdiRemark(stockPdiRemark(vehicle))),
    [sortedVehicles]
  );
  const hasMoreVehicles = sortedVehicles.length > visibleCount;
  const hasRegistrationYear = useMemo(
    () => vehicles.some((vehicle) => Boolean(stockRegistrationYear(vehicle))),
    [vehicles]
  );

  useEffect(() => {
    loadStock();
    loadLineGroups();
    try {
      const raw = window.localStorage.getItem("bigcar-stock-filter-presets");
      if (raw) {
        const parsed = JSON.parse(raw) as FilterPreset[];
        setFilterPresets(parsed.map((preset) => ({ ...preset, filters: normalizeAdvancedFilters(preset.filters) })));
      }
      const rawColumns = window.localStorage.getItem("bigcar-stock-extra-columns");
      if (rawColumns) setExtraColumns(JSON.parse(rawColumns) as ExtraColumnKey[]);
    } catch {
      setFilterPresets([]);
      setExtraColumns([]);
    }
  }, []);

  useEffect(() => {
    if (selectedLineGroupId) {
      window.localStorage.setItem(salesLineGroupStorageKey, selectedLineGroupId);
    }
  }, [selectedLineGroupId]);

  useEffect(() => {
    const availableGroups = new Set(vehicleGroupOptions.map((group) => group.name));
    setSelectedVehicleGroups((current) => current.filter((group) => availableGroups.has(group)));
  }, [vehicleGroupOptions]);

  useEffect(() => {
    setVisibleCount(20);
  }, [advancedFilters, pdiRemarkFilter, query, selectedStatuses, selectedVehicleGroups, sortRules]);

  useEffect(() => {
    window.localStorage.setItem("bigcar-stock-extra-columns", JSON.stringify(extraColumns));
  }, [extraColumns]);

  async function loadStock() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await api<StockListResponse>("/api/stock/list?limit=500");
      setVehicles(data.vehicles);
      if (data.warning) setError(`${data.warning} - ถ้าเพิ่งเพิ่มฟีเจอร์นี้ ต้อง deploy Apps Script เวอร์ชันใหม่ก่อน`);
      else setMessage(`โหลดสต็อก ${data.total.toLocaleString("th-TH")} คันแล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสต็อกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function loadLineGroups() {
    try {
      const data = await api<{ groups: LineGroup[] }>("/api/line/groups");
      setLineGroups(data.groups);
      const savedGroupId = window.localStorage.getItem(salesLineGroupStorageKey) || "";
      const groupId = data.groups.some((group) => group.groupId === savedGroupId) ? savedGroupId : data.groups[0]?.groupId || "";
      setSelectedLineGroupId(groupId);
    } catch {
      setLineGroups([]);
      setSelectedLineGroupId("");
    }
  }

  function clearFilters() {
    setQuery("");
    setSelectedStatuses([]);
    setSelectedVehicleGroups([]);
    setAdvancedFilters(emptyAdvancedFilters);
    setPdiRemarkFilter("all");
    setSortRules([]);
  }

  function setAdvancedFilter<K extends keyof AdvancedStockFilters>(key: K, value: AdvancedStockFilters[K]) {
    setAdvancedFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleAdvancedValue(key: keyof AdvancedStockFilters, value: string) {
    setAdvancedFilters((current) => {
      const currentValue = current[key];
      if (!Array.isArray(currentValue)) return current;
      const nextValue = currentValue.includes(value) ? currentValue.filter((item) => item !== value) : [...currentValue, value];
      return { ...current, [key]: nextValue };
    });
  }

  function clearAdvancedFilter(key: keyof AdvancedStockFilters) {
    setAdvancedFilters((current) => {
      const currentValue = current[key];
      return { ...current, [key]: Array.isArray(currentValue) ? [] : "" };
    });
  }

  function toggleCustomFilterValue(field: string, value: string) {
    setAdvancedFilters((current) => {
      const values = current.customValues[field] || [];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, customValues: { ...current.customValues, [field]: nextValues } };
    });
  }

  function clearCustomFilter(field: string) {
    setAdvancedFilters((current) => {
      const next = { ...current.customValues };
      delete next[field];
      return { ...current, customValues: next };
    });
  }

  function setFieldSort(field: SortField, direction: SortDirection) {
    setSortRules([{ id: `sort-${field}`, field, direction }]);
  }

  function clearFieldSort(field: SortField) {
    setSortRules((current) => current.filter((rule) => rule.field !== field));
  }

  function fieldSortDirection(field: SortField) {
    return sortRules.find((rule) => rule.field === field)?.direction || "";
  }

  async function exportImage(format: ExportFormat) {
    setExporting(true);
    setError("");
    setMessage(`กำลังสร้างไฟล์ ${format.toUpperCase()} ${exportPageCount.toLocaleString("th-TH")} หน้า...`);

    try {
      const { files } = await createStockExportFiles(format);

      const shareData = {
        title: "ตารางสต็อก BIG CAR",
        text: `ตารางสต็อก ${exportVehicles.length.toLocaleString("th-TH")} คัน / ${exportGroups.length.toLocaleString("th-TH")} กลุ่ม / ${files.length.toLocaleString("th-TH")} ไฟล์`,
        files
      };

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setMessage(`เปิดเมนูเซฟ/แชร์แล้ว ${files.length.toLocaleString("th-TH")} ไฟล์`);
        return;
      }

      for (let index = 0; index < files.length; index += 1) {
        const url = URL.createObjectURL(files[index]);
        const link = document.createElement("a");
        link.href = url;
        link.download = files[index].name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }

      setMessage(`Export ${format.toUpperCase()} แล้ว ${files.length.toLocaleString("th-TH")} ไฟล์ จาก ${exportPageCount.toLocaleString("th-TH")} หน้า`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  async function sendLineStockImages() {
    setSendingLine(true);
    setError("");
    setMessage("กำลังสร้างรูป JPG สำหรับส่ง LINE...");

    try {
      if (!selectedLineGroupId) throw new Error("กรุณาเลือกกลุ่ม LINE ก่อนส่ง");
      const bundle = await createStockExportFiles("jpeg");
      setMessage(`กำลังอัปโหลดรูป ${bundle.files.length.toLocaleString("th-TH")} ไฟล์เข้า Drive...`);

      const files = await Promise.all(
        bundle.files.map(async (file, index) => ({
          clientId: `stock-export-${Date.now()}-${index}`,
          category: "stockExport",
          label: "รูปสต็อก",
          name: file.name,
          type: file.type,
          size: file.size,
          base64: await fileToBase64(file)
        }))
      );

      const upload = await postJson<{ result: DriveUploadResult }>("/api/drive/upload", {
        reportType: "sales",
        customerName: "Stock Export",
        plate: "STOCK",
        saleName: senderName(salesProfile),
        files
      });

      const groupNames = exportGroups.map((group) => group.name).slice(0, 8).join(", ");
      const moreGroups = exportGroups.length > 8 ? ` และอีก ${exportGroups.length - 8} กลุ่ม` : "";
      const lineMessage = [
        "ตารางสต็อก BIG CAR",
        `จำนวนรถ: ${bundle.vehicleCount.toLocaleString("th-TH")} คัน`,
        `จำนวนรูป: ${bundle.pageCount.toLocaleString("th-TH")} รูป`,
        `กลุ่ม: ${groupNames || "ทั้งหมด"}${moreGroups}`,
        `อัปเดต: ${new Date().toLocaleDateString("th-TH")}`,
        `ส่งโดย: ${senderName(salesProfile)}`
      ].join("\n");

      const data = await postJson<{ result: { imageCount: number; linkCount: number } }>("/api/line/send-report", {
        groupId: selectedLineGroupId,
        message: lineMessage,
        attachments: upload.result.attachments
      });

      setMessage(`ส่งรูปสต็อกเข้า LINE แล้ว ${data.result.imageCount.toLocaleString("th-TH")} รูป${data.result.linkCount ? ` / ลิงก์ ${data.result.linkCount.toLocaleString("th-TH")} รายการ` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งรูปสต็อกเข้า LINE ไม่สำเร็จ");
    } finally {
      setSendingLine(false);
    }
  }

  async function createStockExportFiles(format: ExportFormat): Promise<StockExportFileBundle> {
    if (!exportVehicles.length) throw new Error("ยังไม่มีรถตามตัวกรองสำหรับ Export");
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Canvas is not ready");

    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    const extension = format === "jpeg" ? "jpg" : "png";
    const files: File[] = [];
    const pdfImages: PdfImage[] = [];
    const contact = await stockExportContactProfile(salesProfile);

    for (const group of exportGroups) {
      for (let index = 0; index < group.pages.length; index += 1) {
        renderStockTableCanvas(canvas, group.pages[index], exportMode, index + 1, group.pages.length, group.name, group.vehicles.length, exportVehicles.length, contact, extraColumns, hasRegistrationYear);
        if (format === "pdf") {
          const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
          pdfImages.push({ bytes: new Uint8Array(await jpegBlob.arrayBuffer()), width: canvas.width, height: canvas.height });
        } else {
          const blob = await canvasToBlob(canvas, mimeType, format === "jpeg" ? 0.92 : undefined);
          files.push(new File([blob], fileName(group.name, extension, index + 1, group.pages.length), { type: mimeType }));
        }
      }
    }

    if (format === "pdf") {
      const blob = buildPdfFromJpegs(pdfImages);
      files.push(new File([blob], pdfFileName(exportGroups.length), { type: "application/pdf" }));
    }

    return {
      files,
      pageCount: exportPageCount,
      groupCount: exportGroups.length,
      vehicleCount: exportVehicles.length
    };
  }

  async function copyImage() {
    setExporting(true);
    setError("");
    setMessage("");

    try {
      if (!exportVehicles.length) throw new Error("ยังไม่มีรถตามตัวกรองสำหรับ Copy");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas is not ready");
      const firstGroup = exportGroups[0];
      const contact = await stockExportContactProfile(salesProfile);
      renderStockTableCanvas(canvas, firstGroup.pages[0] || firstGroup.vehicles, exportMode, 1, Math.max(firstGroup.pages.length, 1), firstGroup.name, firstGroup.vehicles.length, exportVehicles.length, contact, extraColumns, hasRegistrationYear);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("เครื่องนี้ยังไม่รองรับ Copy Image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage("คัดลอกรูปสต็อกแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy รูปไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <NativeAppShell className="max-w-5xl pb-28">
      <NativeAppHeader
        title="Stock Studio"
        subtitle="Live Board Creator"
        actions={<NativeBadge>{exportVehicles.length.toLocaleString("th-TH")} คันที่เลือก</NativeBadge>}
      />

      {(message || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error ? "border-amber-400/40 bg-amber-950/30 text-amber-100" : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          {loading ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{error || message}</span>
        </div>
      )}

      <div className="space-y-4">
          <NativeCard className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1220]/90 p-5 shadow-[0_0_60px_rgba(34,197,94,0.10)]">
            <div className="pointer-events-none absolute -top-14 right-[-8%] h-36 w-36 rounded-full bg-brand/15 blur-[60px]" />
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand/90">สร้างรูปสต็อก</p>
            <h2 className="mt-1 text-[34px] font-black leading-tight text-white">พร้อมส่งลูกค้า</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#050816]/70 px-3 py-3"><p className="text-[13px] font-semibold text-soft">ทั้งหมด</p><p className="mt-1 text-base font-black text-white">{sortedVehicles.length.toLocaleString("th-TH")} คัน</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#050816]/70 px-3 py-3"><p className="text-[13px] font-semibold text-soft">ที่เลือก</p><p className="mt-1 text-base font-black text-white">{exportVehicles.length.toLocaleString("th-TH")} คัน</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#050816]/70 px-3 py-3"><p className="text-[13px] font-semibold text-soft">กลุ่ม</p><p className="mt-1 text-base font-black text-white">{exportGroups.length.toLocaleString("th-TH")} กลุ่ม</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#050816]/70 px-3 py-3"><p className="text-[13px] font-semibold text-soft">หน้า</p><p className="mt-1 text-base font-black text-white">{exportPageCount.toLocaleString("th-TH")} หน้า</p></div>
            </div>
          </NativeCard>
          <NativeCard>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Search size={18} className="text-brand" />
                ค้นหาและกรอง
              </h2>
              <NativeBadge tone="muted">Export Ready</NativeBadge>
            </div>
            {ENABLE_NEW_STOCK_UI ? (
              <StickyFilterBar>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <SearchField
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นทะเบียน / รุ่น / ปี / Location"
                    icon={<Search size={18} />}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <NativeButton
                      type="button"
                      onClick={() => setAdvancedOpen(true)}
                      variant="secondary"
                      className="px-3"
                    >
                      <Filter size={18} className="text-brand" />
                      ตัวกรองขั้นสูง{advancedFilterCount ? ` (${advancedFilterCount})` : ""}
                    </NativeButton>
                    <NativeButton
                      type="button"
                      onClick={() => setColumnsOpen(true)}
                      variant="secondary"
                      className="px-3"
                    >
                      <Columns3 size={18} className="text-brand" />
                      เลือกข้อมูลที่แสดง{extraColumns.length ? ` (${extraColumns.length})` : ""}
                    </NativeButton>
                  </div>
                </div>
                <NativeButton type="button" onClick={clearFilters} variant="ghost" className="w-full">
                  ล้างตัวกรอง
                </NativeButton>
              </StickyFilterBar>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นทะเบียน / รุ่น / ปี / Location"
                    className="h-12 rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
                  />
                  <button type="button" onClick={clearFilters} className="min-h-12 rounded-lg border border-line px-4 font-semibold text-white">
                    ล้างตัวกรอง
                  </button>
                </div>
              </>
            )}
            {ENABLE_NEW_STOCK_UI && (query || selectedStatuses.length || selectedVehicleGroups.length || advancedFilterCount || pdiRemarkFilter !== "all") ? (
              <div className="flex flex-wrap gap-2">
                {query && <ActiveFilterTag onRemove={() => setQuery("")}>ค้นหา: {query}</ActiveFilterTag>}
                {selectedStatuses.map((status) => (
                  <ActiveFilterTag key={`status-${status}`} onRemove={() => setSelectedStatuses((current) => current.filter((item) => item !== status))}>
                    {status}
                  </ActiveFilterTag>
                ))}
                {selectedVehicleGroups.map((group) => (
                  <ActiveFilterTag key={`group-${group}`} onRemove={() => setSelectedVehicleGroups((current) => current.filter((item) => item !== group))}>
                    {group}
                  </ActiveFilterTag>
                ))}
                {advancedFilters.models.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("models")}>รุ่น: {advancedFilters.models.join(", ")}</ActiveFilterTag>}
                {advancedFilters.registrationYears.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("registrationYears")}>ปีจด: {advancedFilters.registrationYears.join(", ")}</ActiveFilterTag>}
                {advancedFilters.colors.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("colors")}>สี: {advancedFilters.colors.join(", ")}</ActiveFilterTag>}
                {advancedFilters.colorGroups.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("colorGroups")}>กลุ่มสี: {advancedFilters.colorGroups.join(", ")}</ActiveFilterTag>}
                {advancedFilters.gears.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("gears")}>เกียร์: {advancedFilters.gears.join(", ")}</ActiveFilterTag>}
                {advancedFilters.statuses.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("statuses")}>สถานะเสริม: {advancedFilters.statuses.join(", ")}</ActiveFilterTag>}
                {advancedFilters.ownerships.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("ownerships")}>กรรมสิทธิ์: {advancedFilters.ownerships.join(", ")}</ActiveFilterTag>}
                {advancedFilters.projects.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("projects")}>PROJECT: {advancedFilters.projects.join(", ")}</ActiveFilterTag>}
                {advancedFilters.campaigns.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("campaigns")}>CAMPAIGN: {advancedFilters.campaigns.join(", ")}</ActiveFilterTag>}
                {advancedFilters.financeNames.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("financeNames")}>ไฟแนนซ์: {advancedFilters.financeNames.join(", ")}</ActiveFilterTag>}
                {advancedFilters.pdiNotes.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("pdiNotes")}>หมายเหตุ PDI: {advancedFilters.pdiNotes.join(", ")}</ActiveFilterTag>}
                {advancedFilters.locations.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("locations")}>Location: {advancedFilters.locations.join(", ")}</ActiveFilterTag>}
                {advancedFilters.vehicleGroups.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("vehicleGroups")}>กลุ่มรถยนต์: {advancedFilters.vehicleGroups.join(", ")}</ActiveFilterTag>}
                {advancedFilters.customerName && <ActiveFilterTag onRemove={() => clearAdvancedFilter("customerName")}>ชื่อลูกค้า: {advancedFilters.customerName}</ActiveFilterTag>}
                {advancedFilters.sellerName && <ActiveFilterTag onRemove={() => clearAdvancedFilter("sellerName")}>ชื่อผู้ขาย: {advancedFilters.sellerName}</ActiveFilterTag>}
                {advancedFilters.plate && <ActiveFilterTag onRemove={() => clearAdvancedFilter("plate")}>ทะเบียน: {advancedFilters.plate}</ActiveFilterTag>}
                {advancedFilters.vin && <ActiveFilterTag onRemove={() => clearAdvancedFilter("vin")}>เลขตัวถัง: {advancedFilters.vin}</ActiveFilterTag>}
                {advancedFilters.engineNo && <ActiveFilterTag onRemove={() => clearAdvancedFilter("engineNo")}>เลขเครื่อง: {advancedFilters.engineNo}</ActiveFilterTag>}
                {advancedFilters.reportReturnFrom || advancedFilters.reportReturnTo ? (
                  <ActiveFilterTag onRemove={() => setAdvancedFilters((current) => ({ ...current, reportReturnFrom: "", reportReturnTo: "" }))}>
                    วันที่รับรายงานคืน: {advancedFilters.reportReturnFrom || "เริ่มต้น"}-{advancedFilters.reportReturnTo || "ล่าสุด"}
                  </ActiveFilterTag>
                ) : null}
                {advancedFilters.bookingSaleFrom || advancedFilters.bookingSaleTo ? (
                  <ActiveFilterTag onRemove={() => setAdvancedFilters((current) => ({ ...current, bookingSaleFrom: "", bookingSaleTo: "" }))}>
                    วันที่จอง/ขาย: {advancedFilters.bookingSaleFrom || "เริ่มต้น"}-{advancedFilters.bookingSaleTo || "ล่าสุด"}
                  </ActiveFilterTag>
                ) : null}
                {sortRules.length > 0 && <ActiveFilterTag onRemove={() => setSortRules([])}>Sort: {sortRules.map((rule) => `${sortFieldLabel(rule.field)} ${rule.direction === "asc" ? "น้อย→มาก" : "มาก→น้อย"}`).join(" / ")}</ActiveFilterTag>}
                {pdiRemarkFilter !== "all" && (
                  <ActiveFilterTag onRemove={() => setPdiRemarkFilter("all")}>
                    หมายเหตุ PDI: {pdiRemarkFilter === "has" ? "มีหมายเหตุ" : "ไม่มีหมายเหตุ"}
                  </ActiveFilterTag>
                )}
                {advancedFilters.mileageBands.length > 0 && <ActiveFilterTag onRemove={() => clearAdvancedFilter("mileageBands")}>ช่วงไมล์: {advancedFilters.mileageBands.join(", ")}</ActiveFilterTag>}
                {(advancedFilters.mileageMin || advancedFilters.mileageMax) && (
                  <ActiveFilterTag
                    onRemove={() => setAdvancedFilters((current) => ({ ...current, mileageMin: "", mileageMax: "" }))}
                  >
                    ไมล์: {advancedFilters.mileageMin || "0"}-{advancedFilters.mileageMax || "∞"}
                  </ActiveFilterTag>
                )}
                {(advancedFilters.priceMin || advancedFilters.priceMax) && (
                  <ActiveFilterTag
                    onRemove={() => setAdvancedFilters((current) => ({ ...current, priceMin: "", priceMax: "" }))}
                  >
                    ราคา: {advancedFilters.priceMin || "0"}-{advancedFilters.priceMax || "∞"}
                  </ActiveFilterTag>
                )}
                {(advancedFilters.agingMin || advancedFilters.agingMax) && (
                  <ActiveFilterTag
                    onRemove={() => setAdvancedFilters((current) => ({ ...current, agingMin: "", agingMax: "" }))}
                  >
                    Aging: {advancedFilters.agingMin || "0"}-{advancedFilters.agingMax || "∞"}
                  </ActiveFilterTag>
                )}
                {Object.entries(advancedFilters.customValues).map(([field, values]) => values.length ? (
                  <ActiveFilterTag key={`custom-${field}`} onRemove={() => clearCustomFilter(field)}>
                    {field}: {values.join(", ")}
                  </ActiveFilterTag>
                ) : null)}
                <button type="button" onClick={clearFilters} className="min-h-8 rounded-full border border-line px-3 text-xs font-bold text-soft transition hover:border-brand hover:text-white">
                  ล้างทั้งหมด
                </button>
              </div>
            ) : null}
            {vehicles.length > 0 && (!importedStatusCount || !importedVehicleGroupCount) && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-950/20 px-3 py-3 text-sm text-amber-100">
                ข้อมูลสถานะ/กลุ่มรถยนต์ยังไม่ครบ กรุณาอัปเดตสต็อกใหม่
              </p>
            )}
            {exportMode === "internal" && (
              <p className={`rounded-lg border px-3 py-3 text-sm ${importedPdiNoteCount > 0 ? "border-line bg-[#0b0d11] text-soft" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
                ระบบอ่านหมายเหตุ PDI ได้ {importedPdiNoteCount.toLocaleString("th-TH")} คันจากสต็อกที่โหลดมา
                {importedPdiNoteCount === 0 ? " - ถ้าไฟล์มีหมายเหตุ กรุณาอัปเดตสต็อกใหม่" : ""}
              </p>
            )}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">สถานะ</p>
              <select
                value={selectedStatuses[0] || "__all__"}
                onChange={(event) => setSelectedStatuses(event.target.value === "__all__" ? [] : [event.target.value])}
                className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none focus:border-brand"
              >
                <option value="__all__">ทั้งหมด</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status} ({statusCounts[status] || 0})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">กลุ่มรถยนต์</p>
              {vehicleGroupOptions.length ? (
                <select
                  value={selectedVehicleGroups[0] || "__all__"}
                  onChange={(event) => setSelectedVehicleGroups(event.target.value === "__all__" ? [] : [event.target.value])}
                  className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none focus:border-brand"
                >
                  <option value="__all__">ทั้งหมด</option>
                  {vehicleGroupOptions.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name} ({group.count})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
                  ยังไม่พบกลุ่มรถยนต์ในสต็อก
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setExportMode("customer")}
                className={`min-h-11 rounded-lg border px-4 font-bold ${
                  exportMode === "customer" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                โหมดลูกค้า
              </button>
              <button
                type="button"
                onClick={() => setExportMode("internal")}
                className={`min-h-11 rounded-lg border px-4 font-bold ${
                  exportMode === "internal" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                โหมดภายใน
              </button>
            </div>
            {exportMode === "internal" ? (
              <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-sm text-amber-100">
                โหมดภายใน: แสดงข้อมูลหมายเหตุ PDI สำหรับหลังบ้านเท่านั้น
              </p>
            ) : (
              <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
                โหมดลูกค้า: ซ่อนหมายเหตุ PDI ใน Preview / Export / รูปที่ส่งลูกค้าเสมอ
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">หมายเหตุ PDI</p>
                <button type="button" onClick={() => setPdiRemarkFilter("all")} className="text-xs font-semibold text-brand">
                  ทั้งหมด
                </button>
              </div>
              <p className="text-xs text-soft">ใช้คัดรถก่อนส่งลูกค้า โดยไม่แสดงข้อความหมายเหตุในโหมดลูกค้า</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "all", label: "ทั้งหมด", count: pdiRemarkCounts.all },
                  { value: "none", label: "ไม่มีหมายเหตุ", count: pdiRemarkCounts.none },
                  { value: "has", label: "มีหมายเหตุ", count: pdiRemarkCounts.has }
                ] as Array<{ value: PdiRemarkFilter; label: string; count: number }>).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPdiRemarkFilter(item.value)}
                    className={`min-h-11 rounded-lg border px-2 text-sm font-bold transition ${
                      pdiRemarkFilter === item.value
                        ? "border-brand bg-brand text-ink"
                        : "border-line bg-[#0b0d11] text-white hover:border-brand/60"
                    }`}
                  >
                    <span className="block leading-5">{item.label}</span>
                    <span className="block text-xs opacity-75">({item.count.toLocaleString("th-TH")})</span>
                  </button>
                ))}
              </div>
              {exportMode === "internal" && pdiRemarkVehicles.length > 0 ? (
                <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-amber-100">หมายเหตุ PDI ที่พบ</p>
                    <span className="rounded-full bg-amber-300/15 px-2 py-1 text-xs font-bold text-amber-100">
                      {pdiRemarkVehicles.length.toLocaleString("th-TH")} คัน
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {pdiRemarkVehicles.slice(0, 5).map((vehicle) => (
                      <div key={`pdi-${vehicle.plate}-${vehicle.vin || vehicle.model}`} className="rounded-md bg-[#0b0d11]/70 px-3 py-2">
                        <p className="text-xs font-bold text-white">{vehicle.plate || "-"} · {vehicleTitle(vehicle)}</p>
                        <p className="mt-1 text-xs leading-5 text-amber-100">{pdiRemarkText(stockPdiRemark(vehicle))}</p>
                      </div>
                    ))}
                  </div>
                  {pdiRemarkVehicles.length > 5 ? (
                    <p className="mt-2 text-xs text-amber-100/80">
                      แสดงตัวอย่าง 5 คันแรก เปิดรายการรถทั้งหมดเพื่อดูครบทุกคัน
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
              Export เป็นตารางแยกตามกลุ่มรถยนต์ หน้า/รูปละ {maxTableItems} คัน ถ้ากลุ่มไหนเกินจะสร้างหลายหน้าพร้อมเลขหน้าอัตโนมัติ
            </p>
          </NativeCard>

        <NativeCard>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <FileImage size={18} className="text-brand" />
              Preview รูป
            </h2>
            <NativeBadge>{exportPageCount.toLocaleString("th-TH")} หน้า</NativeBadge>
          </div>
          <StockPreview vehicles={exportVehicles} mode={exportMode} pageCount={exportPageCount} groupCount={exportGroups.length} extraColumns={extraColumns} hasRegistrationYear={hasRegistrationYear} />
          <div className="grid gap-2 rounded-lg border border-line bg-[#0b0d11] p-3 sm:grid-cols-[1fr_auto]">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">ส่งรูปสต็อกเข้า LINE กลุ่ม</span>
              <select
                value={selectedLineGroupId}
                onChange={(event) => setSelectedLineGroupId(event.target.value)}
                className="min-h-12 w-full rounded-lg border border-line bg-[#080a0d] px-3 text-white outline-none focus:border-brand"
              >
                {lineGroups.length ? (
                  lineGroups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {group.name || group.groupId}
                    </option>
                  ))
                ) : (
                  <option value="">ยังไม่พบกลุ่ม LINE</option>
                )}
              </select>
              {salesProfile && (
                <p className="mt-2 text-xs font-semibold text-soft">
                  ส่งโดย {senderName(salesProfile)}
                </p>
              )}
            </label>
            <NativeButton
              type="button"
              onClick={sendLineStockImages}
              disabled={sendingLine || exporting || !selectedLineGroupId || !exportVehicles.length}
              className="sm:self-end"
            >
              {sendingLine ? <Loader2 size={20} className="animate-spin" /> : <MessageCircle size={20} />}
              ส่ง LINE
            </NativeButton>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <NativeButton
              type="button"
              onClick={() => exportImage("png")}
              disabled={exporting || !exportVehicles.length}
            >
              {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              เซฟ PNG {exportPageCount ? `(${exportPageCount.toLocaleString("th-TH")} รูป)` : ""}
            </NativeButton>
            <NativeButton
              type="button"
              onClick={() => exportImage("jpeg")}
              disabled={exporting || !exportVehicles.length}
              variant="secondary"
            >
              JPG
            </NativeButton>
            <NativeButton
              type="button"
              onClick={() => exportImage("pdf")}
              disabled={exporting || !exportVehicles.length}
              variant="secondary"
            >
              PDF
            </NativeButton>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </NativeCard>

        <NativeCard>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Search size={18} className="text-brand" />
              รายการรถ
            </h2>
            <NativeBadge tone="muted">{sortedVehicles.length.toLocaleString("th-TH")} คัน</NativeBadge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <NativeButton
              type="button"
              onClick={() => setListOpen((current) => !current)}
              variant="secondary"
            >
              {listOpen ? "ซ่อนรายการรถ" : "ดูรายการรถทั้งหมด"}
            </NativeButton>
          </div>

          {!listOpen ? (
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm text-soft">
              ระบบจะใช้รถทั้งหมดที่ตรงเงื่อนไขไปสร้างรูปทันที ไม่ต้องติ๊กเลือกทีละคัน
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                    <Loader2 className="mx-auto mb-2 animate-spin text-brand" />
                    กำลังโหลดสต็อก
                  </div>
                ) : visibleVehicles.length ? (
                  visibleVehicles.map((vehicle) => {
                    const pdiRemark = stockPdiRemark(vehicle);
                    const hasRemark = hasPdiRemark(pdiRemark);
                    return (
                      <div
                        key={`${vehicle.plate}-${vehicle.vin || vehicle.model}`}
                        className={`rounded-lg border bg-panel p-3 text-left ${exportMode === "internal" && hasRemark ? "border-amber-300/40" : "border-line"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-white">{vehicle.plate || "-"}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-soft">{vehicleTitle(vehicle)}</p>
                          </div>
                          <span className="rounded-full bg-[#0b0d11] px-2 py-1 text-xs font-bold text-soft">
                            อยู่ในชุดรูป
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-soft">
                          <span>สถานะ: <b className="text-white">{vehicle.status || "-"}</b></span>
                          <span>กลุ่ม: <b className="text-white">{vehicle.vehicleGroup || "-"}</b></span>
                          <span>Location: <b className="text-white">{vehicle.parkingLocation || "-"}</b></span>
                          <span>ปีจด: <b className="text-white">{stockRegistrationYear(vehicle) || "-"}</b></span>
                          <span>เกียร์: <b className="text-white">{vehicle.gear || "-"}</b></span>
                          <span>สี: <b className="text-white">{vehicle.color || "-"}</b></span>
                          <span>เลขไมล์: <b className="text-white">{formatMileage(vehicle.mileage)}</b></span>
                          <span className="col-span-2">ราคาเสนอขายRT: <b className="text-brand">{formatPrice(vehicle.salePrice)}</b></span>
                          {extraColumns.map((column) => (
                            <span key={`${vehicle.plate}-${column}`} className={column === "pdiNote" || column === "vin" ? "col-span-2" : ""}>
                              {extraColumnLabel(column)}: <b className="text-white">{defaultColumnValue(vehicle, column)}</b>
                            </span>
                          ))}
                        </div>
                        {exportMode === "internal" ? (
                          <div className={`mt-3 rounded-lg border px-3 py-2 ${hasRemark ? "border-amber-300/30 bg-amber-300/10" : "border-line bg-[#0b0d11]"}`}>
                            <p className="text-xs font-bold text-amber-100">หมายเหตุ PDI</p>
                            <p className={`mt-1 text-sm leading-6 ${hasRemark ? "text-amber-50" : "text-soft"}`}>{pdiRemarkText(pdiRemark)}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-line bg-panel p-6 text-center text-soft sm:col-span-2 xl:col-span-3">
                    ไม่พบสต็อกตามเงื่อนไข
                  </div>
                )}
              </div>
              {hasMoreVehicles && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 20)}
                  className="min-h-11 w-full rounded-lg border border-line bg-[#0b0d11] px-4 font-bold text-white transition hover:border-brand"
                >
                  โหลดเพิ่มอีก 20 คัน
                </button>
              )}
            </div>
          )}
        </NativeCard>
      </div>

      <BottomSheet
        open={advancedOpen}
        title="ตัวกรองขั้นสูง"
        onClose={() => setAdvancedOpen(false)}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAdvancedFilters(emptyAdvancedFilters)} className="min-h-11 rounded-lg border border-line px-4 font-bold text-white transition hover:border-brand">
              ล้างเฉพาะ Filter
            </button>
            <button type="button" onClick={() => setAdvancedOpen(false)} className="min-h-11 rounded-lg bg-brand px-4 font-bold text-ink">
              ใช้ตัวกรอง
            </button>
          </div>
        }
      >
        <FilterAccordion title="ข้อมูลรถ" defaultOpen>
          <FieldFilterShell sort={<FieldSortButtons field="location" direction={fieldSortDirection("location")} onSort={setFieldSort} onClear={clearFieldSort} />}>
            <MultiFilter label="Location" values={advancedFilters.locations} options={advancedOptions.locations} onToggle={(value) => toggleAdvancedValue("locations", value)} onClear={() => clearAdvancedFilter("locations")} />
          </FieldFilterShell>
          <FieldFilterShell sort={<FieldSortButtons field="vehicleGroup" direction={fieldSortDirection("vehicleGroup")} onSort={setFieldSort} onClear={clearFieldSort} />}>
            <MultiFilter label="กลุ่มรถยนต์" values={advancedFilters.vehicleGroups} options={advancedOptions.vehicleGroups} onToggle={(value) => toggleAdvancedValue("vehicleGroups", value)} onClear={() => clearAdvancedFilter("vehicleGroups")} />
          </FieldFilterShell>
          <FieldFilterShell sort={<FieldSortButtons field="model" direction={fieldSortDirection("model")} onSort={setFieldSort} onClear={clearFieldSort} />}>
            <MultiFilter label="รุ่นรถยนต์" values={advancedFilters.models} options={advancedOptions.models} onToggle={(value) => toggleAdvancedValue("models", value)} onClear={() => clearAdvancedFilter("models")} />
          </FieldFilterShell>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="plate" direction={fieldSortDirection("plate")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <AdvancedTextField label="ทะเบียน" value={advancedFilters.plate} onChange={(value) => setAdvancedFilter("plate", value)} placeholder="contains" />
            </FieldFilterShell>
            {hasStockFieldData(vehicles, "vin") ? (
              <FieldFilterShell sort={<FieldSortButtons field="vin" direction={fieldSortDirection("vin")} onSort={setFieldSort} onClear={clearFieldSort} />}>
                <AdvancedTextField label="เลขตัวถัง (optional)" value={advancedFilters.vin} onChange={(value) => setAdvancedFilter("vin", value)} placeholder="contains" />
              </FieldFilterShell>
            ) : null}
            {hasStockFieldData(vehicles, "engineNo") ? (
              <FieldFilterShell sort={<FieldSortButtons field="engineNo" direction={fieldSortDirection("engineNo")} onSort={setFieldSort} onClear={clearFieldSort} />}>
                <AdvancedTextField label="เลขเครื่อง (optional)" value={advancedFilters.engineNo} onChange={(value) => setAdvancedFilter("engineNo", value)} placeholder="contains" />
              </FieldFilterShell>
            ) : null}
          </div>
        </FilterAccordion>
        <FilterAccordion title="ราคา / ไมล์ / ปี">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="year" direction={fieldSortDirection("year")} onSort={setFieldSort} onClear={clearFieldSort} ascLabel="เก่า→ใหม่" descLabel="ใหม่→เก่า" />}>
              <MultiFilter label="ปีจด" values={advancedFilters.registrationYears} options={advancedOptions.registrationYears} onToggle={(value) => toggleAdvancedValue("registrationYears", value)} onClear={() => clearAdvancedFilter("registrationYears")} />
            </FieldFilterShell>
            <FieldFilterShell sort={<FieldSortButtons field="color" direction={fieldSortDirection("color")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="สี" values={advancedFilters.colors} options={advancedOptions.colors} onToggle={(value) => toggleAdvancedValue("colors", value)} onClear={() => clearAdvancedFilter("colors")} />
            </FieldFilterShell>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="colorGroup" direction={fieldSortDirection("colorGroup")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="กลุ่มสี" values={advancedFilters.colorGroups} options={advancedOptions.colorGroups} onToggle={(value) => toggleAdvancedValue("colorGroups", value)} onClear={() => clearAdvancedFilter("colorGroups")} />
            </FieldFilterShell>
            <FieldFilterShell sort={<FieldSortButtons field="gear" direction={fieldSortDirection("gear")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="เกียร์" values={advancedFilters.gears} options={advancedOptions.gears} onToggle={(value) => toggleAdvancedValue("gears", value)} onClear={() => clearAdvancedFilter("gears")} />
            </FieldFilterShell>
          </div>
          <FieldFilterShell sort={<FieldSortButtons field="mileage" direction={fieldSortDirection("mileage")} onSort={setFieldSort} onClear={clearFieldSort} ascLabel="น้อย→มาก" descLabel="มาก→น้อย" />}>
            <MultiFilter
              label="เลขไมล์"
              values={advancedFilters.mileageBands}
              options={uniqueSorted(groupMatchedVehicles.map((vehicle) => parseNumeric(vehicle.mileage)).filter((value) => value > 0).sort((a, b) => a - b).map((value) => value.toLocaleString("th-TH")))}
              onToggle={(value) => toggleAdvancedValue("mileageBands", value)}
              onClear={() => clearAdvancedFilter("mileageBands")}
            />
          </FieldFilterShell>
          <FieldFilterShell sort={<FieldSortButtons field="price" direction={fieldSortDirection("price")} onSort={setFieldSort} onClear={clearFieldSort} ascLabel="ต่ำ→สูง" descLabel="สูง→ต่ำ" />}>
            <div className="grid grid-cols-2 gap-2">
              <AdvancedTextField label="ราคาเสนอขายRT ต่ำสุด" value={advancedFilters.priceMin} onChange={(value) => setAdvancedFilter("priceMin", value)} placeholder="เช่น 300000" inputMode="numeric" />
              <AdvancedTextField label="ราคาเสนอขายRT สูงสุด" value={advancedFilters.priceMax} onChange={(value) => setAdvancedFilter("priceMax", value)} placeholder="เช่น 800000" inputMode="numeric" />
            </div>
          </FieldFilterShell>
        </FilterAccordion>
        <FilterAccordion title="สถานะ">
          <FieldFilterShell sort={<FieldSortButtons field="status" direction={fieldSortDirection("status")} onSort={setFieldSort} onClear={clearFieldSort} />}>
            <MultiFilter label="สถานะ" values={advancedFilters.statuses} options={advancedOptions.statuses} onToggle={(value) => toggleAdvancedValue("statuses", value)} onClear={() => clearAdvancedFilter("statuses")} />
          </FieldFilterShell>
          <FieldFilterShell sort={<FieldSortButtons field="ownership" direction={fieldSortDirection("ownership")} onSort={setFieldSort} onClear={clearFieldSort} />}>
            <MultiFilter label="กรรมสิทธิ์" values={advancedFilters.ownerships} options={advancedOptions.ownerships} onToggle={(value) => toggleAdvancedValue("ownerships", value)} onClear={() => clearAdvancedFilter("ownerships")} />
          </FieldFilterShell>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="project" direction={fieldSortDirection("project")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="PROJECT" values={advancedFilters.projects} options={advancedOptions.projects} onToggle={(value) => toggleAdvancedValue("projects", value)} onClear={() => clearAdvancedFilter("projects")} />
            </FieldFilterShell>
            <FieldFilterShell sort={<FieldSortButtons field="campaign" direction={fieldSortDirection("campaign")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="CAMPAIGN" values={advancedFilters.campaigns} options={advancedOptions.campaigns} onToggle={(value) => toggleAdvancedValue("campaigns", value)} onClear={() => clearAdvancedFilter("campaigns")} />
            </FieldFilterShell>
          </div>
        </FilterAccordion>
        <FilterAccordion title="ลูกค้า / ผู้ขาย">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="customerName" direction={fieldSortDirection("customerName")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <AdvancedTextField label="ชื่อลูกค้า" value={advancedFilters.customerName} onChange={(value) => setAdvancedFilter("customerName", value)} placeholder="contains" />
            </FieldFilterShell>
            <FieldFilterShell sort={<FieldSortButtons field="sellerName" direction={fieldSortDirection("sellerName")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <AdvancedTextField label="ชื่อผู้ขาย" value={advancedFilters.sellerName} onChange={(value) => setAdvancedFilter("sellerName", value)} placeholder="contains" />
            </FieldFilterShell>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="closedSales" direction={fieldSortDirection("closedSales")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="Closed Sales" values={advancedFilters.closedSales} options={advancedOptions.closedSales} onToggle={(value) => toggleAdvancedValue("closedSales", value)} onClear={() => clearAdvancedFilter("closedSales")} />
            </FieldFilterShell>
            <FieldFilterShell sort={<FieldSortButtons field="agingGroup" direction={fieldSortDirection("agingGroup")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="กลุ่มAging" values={advancedFilters.agingGroups} options={advancedOptions.agingGroups} onToggle={(value) => toggleAdvancedValue("agingGroups", value)} onClear={() => clearAdvancedFilter("agingGroups")} />
            </FieldFilterShell>
          </div>
          <FieldFilterShell sort={<FieldSortButtons field="aging" direction={fieldSortDirection("aging")} onSort={setFieldSort} onClear={clearFieldSort} ascLabel="น้อย→มาก" descLabel="มาก→น้อย" />}>
            <MultiFilter label="Aging" values={advancedFilters.agings} options={advancedOptions.agings} onToggle={(value) => toggleAdvancedValue("agings", value)} onClear={() => clearAdvancedFilter("agings")} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <AdvancedTextField label="Aging ต่ำสุด" value={advancedFilters.agingMin} onChange={(value) => setAdvancedFilter("agingMin", value)} placeholder="เช่น 30" inputMode="numeric" />
              <AdvancedTextField label="Aging สูงสุด" value={advancedFilters.agingMax} onChange={(value) => setAdvancedFilter("agingMax", value)} placeholder="เช่น 90" inputMode="numeric" />
            </div>
          </FieldFilterShell>
        </FilterAccordion>
        <FilterAccordion title="วันที่">
          <FieldFilterShell sort={<FieldSortButtons field="reportReturnDate" direction={fieldSortDirection("reportReturnDate")} onSort={setFieldSort} onClear={clearFieldSort} ascLabel="เก่าสุด" descLabel="ใหม่สุด" />}>
            <div className="grid grid-cols-2 gap-2">
              <AdvancedTextField label="วันที่รับรายงานคืน จาก" value={advancedFilters.reportReturnFrom} onChange={(value) => setAdvancedFilter("reportReturnFrom", value)} inputType="date" />
              <AdvancedTextField label="วันที่รับรายงานคืน ถึง" value={advancedFilters.reportReturnTo} onChange={(value) => setAdvancedFilter("reportReturnTo", value)} inputType="date" />
            </div>
          </FieldFilterShell>
          <FieldFilterShell sort={<FieldSortButtons field="bookingSaleDate" direction={fieldSortDirection("bookingSaleDate")} onSort={setFieldSort} onClear={clearFieldSort} ascLabel="เก่าสุด" descLabel="ใหม่สุด" />}>
            <div className="grid grid-cols-2 gap-2">
              <AdvancedTextField label="วันที่จอง/ขาย จาก" value={advancedFilters.bookingSaleFrom} onChange={(value) => setAdvancedFilter("bookingSaleFrom", value)} inputType="date" />
              <AdvancedTextField label="วันที่จอง/ขาย ถึง" value={advancedFilters.bookingSaleTo} onChange={(value) => setAdvancedFilter("bookingSaleTo", value)} inputType="date" />
            </div>
          </FieldFilterShell>
        </FilterAccordion>
        <FilterAccordion title="PDI / Inspection / Warranty">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldFilterShell sort={<FieldSortButtons field="inspection" direction={fieldSortDirection("inspection")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="Inspection" values={advancedFilters.inspections} options={advancedOptions.inspections} onToggle={(value) => toggleAdvancedValue("inspections", value)} onClear={() => clearAdvancedFilter("inspections")} />
            </FieldFilterShell>
            <FieldFilterShell sort={<FieldSortButtons field="extendedWarranty" direction={fieldSortDirection("extendedWarranty")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="Extended Warranty" values={advancedFilters.extendedWarranties} options={advancedOptions.extendedWarranties} onToggle={(value) => toggleAdvancedValue("extendedWarranties", value)} onClear={() => clearAdvancedFilter("extendedWarranties")} />
            </FieldFilterShell>
          </div>
          <FieldFilterShell sort={<FieldSortButtons field="pdiStatus" direction={fieldSortDirection("pdiStatus")} onSort={setFieldSort} onClear={clearFieldSort} />}>
            <MultiFilter label="สถานะปรับสภาพ PDI" values={advancedFilters.pdiStatuses} options={advancedOptions.pdiStatuses} onToggle={(value) => toggleAdvancedValue("pdiStatuses", value)} onClear={() => clearAdvancedFilter("pdiStatuses")} />
          </FieldFilterShell>
          {extraColumns.includes("pdiNote") ? (
            <FieldFilterShell sort={<FieldSortButtons field="pdiNote" direction={fieldSortDirection("pdiNote")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="หมายเหตุ PDI" values={advancedFilters.pdiNotes} options={advancedOptions.pdiNotes} onToggle={(value) => toggleAdvancedValue("pdiNotes", value)} onClear={() => clearAdvancedFilter("pdiNotes")} />
            </FieldFilterShell>
          ) : null}
          {extraColumns.includes("financeName") ? (
            <FieldFilterShell sort={<FieldSortButtons field="financeName" direction={fieldSortDirection("financeName")} onSort={setFieldSort} onClear={clearFieldSort} />}>
              <MultiFilter label="ไฟแนนซ์" values={advancedFilters.financeNames} options={advancedOptions.financeNames} onToggle={(value) => toggleAdvancedValue("financeNames", value)} onClear={() => clearAdvancedFilter("financeNames")} />
            </FieldFilterShell>
          ) : null}
        </FilterAccordion>
        {extraColumns.some((key) => customExtraColumnName(key)) ? (
          <FilterAccordion title="ข้อมูลที่เลือกแสดงเพิ่ม">
            <div className="grid gap-3 sm:grid-cols-2">
              {extraColumns.map((key) => {
                const customName = customExtraColumnName(key);
                if (!customName) return null;
                return (
                  <FieldFilterShell key={key} sort={<FieldSortButtons field={key as SortField} direction={fieldSortDirection(key as SortField)} onSort={setFieldSort} onClear={clearFieldSort} />}>
                    <MultiFilter
                      label={customName}
                      values={advancedFilters.customValues[customName] || []}
                      options={customFieldOptions[customName] || []}
                      onToggle={(value) => toggleCustomFilterValue(customName, value)}
                      onClear={() => clearCustomFilter(customName)}
                    />
                  </FieldFilterShell>
                );
              })}
            </div>
          </FilterAccordion>
        ) : null}
      </BottomSheet>

      <div className="fixed inset-x-0 bottom-4 z-40 px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 rounded-[24px] border border-white/10 bg-[#0b1220]/90 p-2 shadow-[0_0_40px_rgba(34,197,94,0.10)] backdrop-blur-xl">
          <NativeButton type="button" onClick={() => setListOpen(true)} variant="secondary" className="flex-1">
            <FileImage size={18} />
            Preview
          </NativeButton>
          <NativeButton type="button" onClick={sendLineStockImages} disabled={sendingLine || exporting || !selectedLineGroupId || !exportVehicles.length} className="flex-1">
            <MessageCircle size={18} />
            ส่ง LINE
          </NativeButton>
          <NativeButton type="button" onClick={() => exportImage("png")} disabled={exporting || !exportVehicles.length} className="flex-1">
            <Download size={18} />
            Export PNG
          </NativeButton>
        </div>
      </div>

      <BottomSheet
        open={columnsOpen}
        title="เลือกข้อมูลที่แสดง"
        onClose={() => setColumnsOpen(false)}
        footer={<button type="button" onClick={() => setColumnsOpen(false)} className="min-h-11 w-full rounded-lg bg-brand px-4 font-bold text-ink">ใช้คอลัมน์นี้</button>}
      >
        <p className="rounded-lg border border-line bg-[#0b0d11] p-3 text-sm text-soft">
          ค่าเริ่มต้นยังเหมือนเดิม คอลัมน์เสริมจะแสดงเฉพาะในรายการรถด้านล่างเมื่อคุณติ๊กเลือก
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableExtraColumns.length ? availableExtraColumns.map((key) => (
            <label key={key} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-bold ${extraColumns.includes(key) ? "border-brand bg-brand/10 text-brand" : "border-line bg-[#0b0d11] text-white"}`}>
              <input
                type="checkbox"
                checked={extraColumns.includes(key)}
                onChange={(event) => setExtraColumns((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))}
                className="h-5 w-5 accent-brand"
              />
              {extraColumnLabel(key)}
            </label>
          )) : (
            <p className="rounded-lg border border-dashed border-line bg-[#0b0d11] p-4 text-center text-sm text-soft sm:col-span-2">
              ยังไม่พบคอลัมน์เสริมจากไฟล์สต็อกจริงในข้อมูลที่โหลดมา
            </p>
          )}
        </div>
        {extraColumns.length ? (
          <button type="button" onClick={() => setExtraColumns([])} className="min-h-10 rounded-lg border border-line px-3 text-sm font-bold text-white">
            ล้างคอลัมน์เสริม
          </button>
        ) : null}
      </BottomSheet>
    </NativeAppShell>
  );
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) throw new Error("ไม่สามารถสร้างไฟล์รูปได้");
  return blob;
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
  return dataUrl.split(",")[1] || "";
}

function buildPdfFromJpegs(images: PdfImage[]) {
  if (!images.length) throw new Error("ยังไม่มีหน้าสำหรับสร้าง PDF");

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const objectCount = 2 + images.length * 3;
  const pageIds = images.map((_, index) => 3 + index * 3);

  const writeObject = (id: number, body: (write: typeof push) => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body(push);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%stock-export\n");
  writeObject(1, (write) => write("<< /Type /Catalog /Pages 2 0 R >>"));
  writeObject(2, (write) => write(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${images.length} >>`));

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const pageWidth = 842;
    const pageHeight = Math.round((pageWidth * image.height) / image.width);
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im${index + 1} Do\nQ`;

    writeObject(pageId, (write) => {
      write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    writeObject(contentId, (write) => {
      write(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    });
    writeObject(imageId, (write) => {
      write(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
      write(image.bytes);
      write("\nendstream");
    });
  });

  const xrefOffset = length;
  push(`xref\n0 ${objectCount + 1}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const blobParts = chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer;
  });
  return new Blob(blobParts, { type: "application/pdf" });
}

function FilterAccordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-[#0b0d11]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left font-black text-white"
      >
        <span>{title}</span>
        <span className="text-brand">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="space-y-3 border-t border-line p-3">{children}</div> : null}
    </section>
  );
}

function MultiFilter({
  label,
  values,
  options,
  onToggle,
  onClear
}: {
  label: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const visibleOptions = useMemo(() => {
    const term = normalizeText(search);
    return options.filter((option) => !term || normalizeText(option).includes(term)).slice(0, 60);
  }, [options, search]);
  const summary = values.length ? values.slice(0, 2).join(", ") + (values.length > 2 ? ` +${values.length - 2}` : "") : "ทั้งหมด";

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-black/20 px-3 text-left"
      >
        <span>
          <span className="block text-sm font-bold text-white">{label}</span>
          <span className={`mt-0.5 block truncate text-xs ${values.length ? "text-brand" : "text-soft"}`}>{summary}</span>
        </span>
        <span className="text-sm font-black text-brand">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-line bg-black/20 p-2">
          <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`ค้นหา${label}`}
              className="h-10 min-w-0 rounded-lg border border-line bg-black/30 px-3 text-sm text-white outline-none focus:border-brand"
            />
            {values.length ? (
              <button type="button" onClick={onClear} className="h-10 rounded-lg border border-line px-3 text-xs font-bold text-brand">
                ล้าง
              </button>
            ) : null}
          </div>
          <div className="grid max-h-56 gap-1 overflow-y-auto pr-1">
            {visibleOptions.length ? visibleOptions.map((option) => {
              const active = values.includes(option);
              return (
                <label
                  key={option}
                  className={`flex min-h-10 items-center gap-3 rounded-lg border px-3 text-sm font-bold transition ${active ? "border-brand bg-brand/10 text-brand" : "border-line bg-panel text-soft"}`}
                >
                  <input type="checkbox" checked={active} onChange={() => onToggle(option)} className="h-4 w-4 accent-brand" />
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                </label>
              );
            }) : (
              <p className="w-full rounded-lg border border-line bg-black/20 p-3 text-center text-xs text-soft">ไม่มีตัวเลือกจากข้อมูลสต็อก</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldFilterShell({ children, sort }: { children: ReactNode; sort?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-black/15 p-2">
      {children}
      {sort ? <div className="mt-2">{sort}</div> : null}
    </div>
  );
}

function FieldSortButtons({
  field,
  direction,
  ascLabel = "ก-ฮ / น้อย→มาก",
  descLabel = "ฮ-ก / มาก→น้อย",
  onSort,
  onClear
}: {
  field: SortField;
  direction: SortDirection | "";
  ascLabel?: string;
  descLabel?: string;
  onSort: (field: SortField, direction: SortDirection) => void;
  onClear: (field: SortField) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-[#0b0d11] p-2">
      <span className="text-xs font-bold text-soft">เรียง {sortFieldLabel(field)}</span>
      <button
        type="button"
        onClick={() => onSort(field, "asc")}
        className={`min-h-8 rounded-lg border px-2 text-xs font-bold transition ${direction === "asc" ? "border-brand bg-brand text-ink" : "border-line text-soft hover:border-brand hover:text-white"}`}
      >
        {ascLabel}
      </button>
      <button
        type="button"
        onClick={() => onSort(field, "desc")}
        className={`min-h-8 rounded-lg border px-2 text-xs font-bold transition ${direction === "desc" ? "border-brand bg-brand text-ink" : "border-line text-soft hover:border-brand hover:text-white"}`}
      >
        {descLabel}
      </button>
      {direction ? (
        <button type="button" onClick={() => onClear(field)} className="min-h-8 rounded-lg border border-line px-2 text-xs font-bold text-soft transition hover:border-brand hover:text-white">
          ล้าง
        </button>
      ) : null}
    </div>
  );
}

function AdvancedTextField({
  label,
  value,
  placeholder,
  inputMode,
  inputType = "text",
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  inputType?: "text" | "date";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-white">{label}</span>
      <input
        type={inputType}
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function ExportPlanSummary({ groups, pageCount, vehicleCount }: { groups: StockExportGroup[]; pageCount: number; vehicleCount: number }) {
  const visibleGroups = groups.slice(0, 6);
  const hiddenCount = Math.max(groups.length - visibleGroups.length, 0);

  if (!vehicleCount) {
    return (
      <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-4 text-center text-sm text-soft">
        เลือกสถานะหรือกลุ่มรถยนต์เพื่อดูจำนวนไฟล์ก่อน Export
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">สรุปไฟล์ที่จะได้</p>
          <p className="mt-1 text-xs text-soft">
            {vehicleCount.toLocaleString("th-TH")} คัน / {groups.length.toLocaleString("th-TH")} กลุ่ม / {pageCount.toLocaleString("th-TH")} หน้า
          </p>
        </div>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
          {maxTableItems} คันต่อหน้า
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleGroups.map((group) => (
          <div key={group.name} className="rounded-lg border border-line bg-panel/70 px-3 py-2">
            <p className="truncate text-sm font-bold text-white">{group.name}</p>
            <p className="mt-1 text-xs text-soft">
              {group.vehicles.length.toLocaleString("th-TH")} คัน - {group.pages.length.toLocaleString("th-TH")} หน้า
            </p>
          </div>
        ))}
      </div>
      {hiddenCount ? (
        <p className="mt-2 text-xs text-soft">
          และอีก {hiddenCount.toLocaleString("th-TH")} กลุ่ม จะถูกสร้างไฟล์ตามลำดับอัตโนมัติ
        </p>
      ) : null}
    </div>
  );
}

function StockPreview({
  vehicles,
  mode,
  pageCount,
  groupCount,
  extraColumns,
  hasRegistrationYear
}: {
  vehicles: StockVehicle[];
  mode: ExportMode;
  pageCount: number;
  groupCount: number;
  extraColumns: ExtraColumnKey[];
  hasRegistrationYear: boolean;
}) {
  const columns = stockExportColumns(mode, extraColumns, hasRegistrationYear);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#f6f8f7] text-[#111827] shadow-glow">
      <div className="border-b border-[#d9e1df] bg-[#f9fbfa] p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#15803d]">Stock Catalog Preview</p>
        <h2 className="mt-1 text-xl font-black text-[#111827]">ตารางสต็อกพร้อมส่ง</h2>
        <p className="mt-1 text-xs text-[#64748b]">
          {vehicles.length.toLocaleString("th-TH")} คัน / {groupCount.toLocaleString("th-TH")} กลุ่ม / {Math.max(pageCount, vehicles.length ? 1 : 0).toLocaleString("th-TH")} รูป /{" "}
          {mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#17211d] text-white">
              {columns.map((column) => (
                <th key={column.key} className={`border border-[#2d3a35] px-2 py-2 font-bold ${column.key === "pdi" ? "bg-[#7c4a03] text-left" : "text-left"}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.slice(0, 8).map((vehicle) => (
              <tr key={vehicle.plate} className="bg-white">
                {columns.map((column) => {
                  const value = previewColumnValue(vehicle, column, mode);
                  return (
                    <td
                      key={`${vehicle.plate}-${column.key}`}
                      className={`border border-[#dce3e1] px-2 py-1 ${
                        column.key === "price"
                          ? "bg-[#e6fbf3] text-right text-sm font-black"
                          : column.key === "pdi"
                            ? hasPdiRemark(stockPdiRemark(vehicle)) ? "bg-[#fff7ed] text-left font-semibold text-[#7c2d12]" : "text-left text-[#64748b]"
                            : column.key === "mileage" ? "text-right" : column.key === "model" || column.key === "location" ? "text-left" : "text-center"
                      }`}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!vehicles.length ? <p className="p-6 text-center text-sm text-[#475569]">เลือกสต็อกเพื่อดู Preview</p> : null}
    </div>
  );
}

function previewColumnValue(vehicle: StockVehicle, column: StockExportColumn, mode: ExportMode) {
  if (column.extraKey) return defaultColumnValue(vehicle, column.extraKey);
  if (column.key === "location") return shortLocation(vehicle.parkingLocation);
  if (column.key === "plate") return vehicle.plate || "-";
  if (column.key === "registrationYear") return stockRegistrationYear(vehicle) || "-";
  if (column.key === "model") return vehicleTitle(vehicle);
  if (column.key === "gear") return vehicle.gear || "-";
  if (column.key === "color") return vehicle.color || "-";
  if (column.key === "mileage") return formatMileage(vehicle.mileage).replace(" กม.", "");
  if (column.key === "price") return formatPrice(vehicle.salePrice).replace(" บาท", "");
  if (column.key === "pdi" && mode === "internal") return pdiRemarkText(stockPdiRemark(vehicle));
  return "-";
}

function renderStockTableCanvas(
  canvas: HTMLCanvasElement,
  vehicles: StockVehicle[],
  mode: ExportMode,
  page: number,
  totalPages: number,
  groupName: string,
  groupTotal: number,
  exportTotal: number,
  contact: StockExportContact | null = null,
  extraColumns: ExtraColumnKey[] = [],
  hasRegistrationYear = false
) {
  const margin = 44;
  const headerHeight = 126;
  const tableTop = 166;
  const rowHeight = mode === "internal" ? (vehicles.length <= 3 ? 100 : vehicles.length <= 8 ? 92 : 84) : vehicles.length <= 3 ? 76 : vehicles.length <= 8 ? 66 : 58;
  const footerHeight = 60;
  const rows = vehicles.slice(0, maxTableItems);
  const headerRowHeight = 56;
  const columns = stockExportColumns(mode, extraColumns, hasRegistrationYear);
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const width = Math.max(1800, tableWidth + margin * 2);
  const height = tableTop + headerRowHeight + rows.length * rowHeight + footerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.scale(ratio, ratio);

  ctx.fillStyle = "#f4f7f5";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(margin, 26, width - margin * 2, headerHeight);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(margin, 26, 8, headerHeight);
  ctx.strokeStyle = "#d9e1df";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(margin, 26, width - margin * 2, headerHeight);

  ctx.fillStyle = "#111827";
  ctx.font = "900 48px Arial, Tahoma, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(groupName || "Stock", margin + 30, 82);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 24px Arial, Tahoma, sans-serif";
  ctx.fillText(
    `${groupTotal.toLocaleString("th-TH")} คัน | อัปเดต ${new Date().toLocaleDateString("th-TH")} | ${mode === "customer" ? "สำหรับลูกค้า" : "สำหรับภายใน"}`,
    margin + 30,
    120
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#111827";
  ctx.font = "800 30px Arial, Tahoma, sans-serif";
  ctx.fillText(`หน้า ${page}/${totalPages}`, contact?.lineQrImage || contact?.avatarImage ? width - margin - 132 : width - margin - 28, 82);
  drawStockExportContact(ctx, contact, width - margin - 28, 42);

  let x = margin;
  ctx.font = "800 23px Arial, Tahoma, sans-serif";
  columns.forEach((column) => {
    ctx.fillStyle = column.key === "price" ? "#0f766e" : column.key === "pdi" ? "#7c4a03" : "#13221c";
    ctx.fillRect(x, tableTop, column.width, headerRowHeight);
    ctx.strokeStyle = "#2d3a35";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, tableTop, column.width, headerRowHeight);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = column.key === "price" ? "right" : "center";
    ctx.fillText(column.label, column.key === "price" ? x + column.width - 18 : x + column.width / 2, tableTop + 36);
    x += column.width;
  });

  rows.forEach((vehicle, rowIndex) => {
    const rowY = tableTop + headerRowHeight + rowIndex * rowHeight;
    const values: Record<string, string> = {
      location: shortLocation(vehicle.parkingLocation),
      plate: vehicle.plate || "-",
      registrationYear: stockRegistrationYear(vehicle) || "-",
      model: vehicleTitle(vehicle),
      gear: vehicle.gear || "-",
      color: vehicle.color || "-",
      mileage: formatMileage(vehicle.mileage).replace(" กม.", ""),
      price: formatPrice(vehicle.salePrice).replace(" บาท", ""),
      pdi: mode === "internal" ? pdiRemarkText(stockPdiRemark(vehicle)) : ""
    };

    x = margin;
    columns.forEach((column) => {
      if (column.extraKey) values[column.key] = defaultColumnValue(vehicle, column.extraKey);
      ctx.fillStyle = column.key === "price" ? "#e8fbf2" : rowIndex % 2 ? "#fbfcfc" : "#ffffff";
      ctx.fillRect(x, rowY, column.width, rowHeight);
      ctx.strokeStyle = "#dce3e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, rowY, column.width, rowHeight);
      ctx.fillStyle = "#111827";
      ctx.font = column.key === "price" ? "900 24px Arial, Tahoma, sans-serif" : column.key === "pdi" ? "600 18px Arial, Tahoma, sans-serif" : column.extraKey ? "600 18px Arial, Tahoma, sans-serif" : mode === "internal" ? "600 19px Arial, Tahoma, sans-serif" : "600 21px Arial, Tahoma, sans-serif";
      ctx.textAlign = column.key === "price" || column.key === "mileage" ? "right" : column.key === "model" || column.key === "location" || column.key === "pdi" || column.extraKey === "vin" || column.extraKey === "engineNo" ? "left" : "center";
      const textX =
        column.key === "price" || column.key === "mileage" ? x + column.width - 14 : column.key === "model" || column.key === "location" || column.key === "pdi" || column.extraKey === "vin" || column.extraKey === "engineNo" ? x + 14 : x + column.width / 2;
      if (column.key === "model") {
        drawWrappedCellText(ctx, values[column.key], textX, rowY + 23, column.width - 28, 25, 2);
      } else if (column.key === "pdi") {
        ctx.fillStyle = hasPdiRemark(stockPdiRemark(vehicle)) ? "#7c2d12" : "#6b7280";
        drawWrappedCellText(ctx, values[column.key], textX, rowY + 24, column.width - 28, 24, 3);
      } else if (column.extraKey === "vin" || column.extraKey === "engineNo") {
        drawWrappedCellText(ctx, values[column.key], textX, rowY + 23, column.width - 28, 23, 2);
      } else if (column.key === "location" || column.key === "color") {
        drawBadgeCellText(ctx, values[column.key], textX, rowY + Math.floor(rowHeight / 2), column.width - 24);
      } else {
        drawClippedText(ctx, values[column.key], textX, rowY + Math.floor(rowHeight / 2) + 7, column.width - 20);
      }
      x += column.width;
    });
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 20px Arial, Tahoma, sans-serif";
  ctx.fillText(
    contact ? `ผู้ติดต่อ ${contact.name}${contact.phone ? ` ${contact.phone}` : ""}${contact.lineId ? ` | LINE ${contact.lineId}` : ""}` : "Generated from latest stock",
    margin,
    height - 22
  );
  ctx.textAlign = "right";
  ctx.fillText(`จำนวนรถทั้งหมด ${exportTotal.toLocaleString("th-TH")} คัน`, width - margin, height - 22);
  ctx.textAlign = "left";
}

function chunkVehicles(vehicles: StockVehicle[], size: number) {
  const chunks: StockVehicle[][] = [];
  for (let index = 0; index < vehicles.length; index += size) {
    chunks.push(vehicles.slice(index, index + size));
  }
  return chunks;
}

function groupVehiclesForExport(vehicles: StockVehicle[]): StockExportGroup[] {
  const groups = new Map<string, StockVehicle[]>();

  vehicles.forEach((vehicle) => {
    const groupName = stockVehicleGroup(vehicle) || "ไม่ระบุ";
    const list = groups.get(groupName) || [];
    list.push(vehicle);
    groups.set(groupName, list);
  });

  return Array.from(groups.entries())
    .map(([name, groupVehicles]) => ({
      name,
      vehicles: groupVehicles,
      pages: chunkVehicles(groupVehicles, maxTableItems)
    }))
    .sort((a, b) => b.vehicles.length - a.vehicles.length || a.name.localeCompare(b.name, "th"));
}

function drawStockExportContact(ctx: CanvasRenderingContext2D, contact: StockExportContact | null, right: number, top: number) {
  if (!contact) return;
  const image = contact.lineQrImage || contact.avatarImage;
  if (!image) return;

  const size = contact.lineQrImage ? 86 : 70;
  const left = right - size;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, left - 8, top - 8, size + 16, size + 16, 14);
  ctx.fill();
  ctx.strokeStyle = "#d9e1df";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (contact.lineQrImage) {
    ctx.drawImage(image, left, top, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(left + size / 2, top + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, left, top, size, size);
  }
  ctx.restore();

  ctx.save();
  ctx.textAlign = "right";
  ctx.fillStyle = "#111827";
  ctx.font = "800 18px Arial, Tahoma, sans-serif";
  ctx.fillText(contact.name, left - 16, top + 34);
  ctx.fillStyle = "#64748b";
  ctx.font = "700 16px Arial, Tahoma, sans-serif";
  if (contact.phone) ctx.fillText(contact.phone, left - 16, top + 58);
  if (contact.lineId) ctx.fillText(`LINE ${contact.lineId}`, left - 16, top + 82);
  ctx.restore();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawClippedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.save();
  const align = ctx.textAlign;
  const clipX = align === "right" ? x - maxWidth : align === "center" ? x - maxWidth / 2 : x;
  ctx.beginPath();
  ctx.rect(clipX, y - 25, maxWidth, 34);
  ctx.clip();
  ctx.fillText(text || "-", x, y);
  ctx.restore();
}

function drawBadgeCellText(ctx: CanvasRenderingContext2D, text: string, x: number, centerY: number, maxWidth: number) {
  const value = text || "-";
  const measured = Math.min(ctx.measureText(value).width + 20, maxWidth);
  ctx.save();
  const align = ctx.textAlign;
  const left = align === "center" ? x - measured / 2 : align === "right" ? x - measured : x;
  drawRoundedRect(ctx, left, centerY - 15, measured, 30, 15);
  ctx.fillStyle = "#eef7f2";
  ctx.fill();
  ctx.strokeStyle = "#cfe3d7";
  ctx.stroke();
  ctx.fillStyle = "#14532d";
  ctx.textAlign = "center";
  drawClippedText(ctx, value, left + measured / 2, centerY + 7, measured - 14);
  ctx.restore();
}

function drawWrappedCellText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const value = text || "-";
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) {
    let last = visibleLines[visibleLines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    visibleLines[visibleLines.length - 1] = `${last}…`;
  }

  visibleLines.forEach((line, index) => {
    drawClippedText(ctx, line, x, y + index * lineHeight, maxWidth);
  });
}

function loadStockCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("โหลดรูปโปรไฟล์ไม่สำเร็จ"));
    image.src = src;
  });
}
