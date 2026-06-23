"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Image as ImageIcon, Loader2, Share2 } from "lucide-react";
import type { ReportHistoryItem } from "@/lib/types";
import { DOC_V2_TEMPLATE_ID } from "@/lib/documents-v2/types";
import { documentTemplatesV2, getDocumentV2Templates, type DocumentV2TemplateId } from "@/lib/documents-v2/template-config";
import type { DocumentV2FieldKey, DocumentV2FieldMapping, DocumentV2MappedValue } from "@/lib/documents-v2/mapping-store";
import { mapBookingToDocumentV2 } from "@/lib/documents-v2/types";
import type { DocumentV2ResolveDebug, ResolvedDocumentV2Data } from "@/lib/documents-v2/resolve-data";
import { PowerOfAttorneyOcrScanner } from "@/components/documents/PowerOfAttorneyOcrScanner";
import {
  composePowerOfAttorneyVehiclePlate,
  splitPowerOfAttorneyAddress,
  type PowerOfAttorneySuggestion
} from "@/lib/documents-v2/power-of-attorney";

type FieldItem = { name: string; type: string };
type FieldsDebug = {
  selectedTemplate: { id: string; fileName: string; path: string };
  fetchStatus: number;
  fieldsCount: number;
  fieldNames: string[];
};

type TemporaryReceiptExtraStatus = "none" | "gift" | "charge";
type TemporaryReceiptExtraData = {
  row3NetPriceNote: string;
  row1Note: string;
  row3Note: string;
  bookingDate: string;
  depositDate: string;
  line2Discount: string;
  line4Installment: string;
  line5DownPayment: string;
  line6Amount: string;
  line7Amount: string;
  line8Amount: string;
  line9Amount: string;
  line10Amount: string;
  line11Amount: string;
  line12Amount: string;
  line13Amount: string;
  line14Amount: string;
  line6Status: TemporaryReceiptExtraStatus;
  line7Status: TemporaryReceiptExtraStatus;
  line8Status: TemporaryReceiptExtraStatus;
  line9Status: TemporaryReceiptExtraStatus;
  line10Status: TemporaryReceiptExtraStatus;
  line11Status: TemporaryReceiptExtraStatus;
  line12Status: TemporaryReceiptExtraStatus;
  line13Status: TemporaryReceiptExtraStatus;
  line14Status: TemporaryReceiptExtraStatus;
};

type PowerOfAttorneyPurpose = "มอบอำนาจรับรถแทน" | "สำหรับโอนรถยนต์";
type PowerOfAttorneyExtraData = {
  purpose: PowerOfAttorneyPurpose;
  customer_age: string;
  customer_race: string;
  customer_nationality: string;
  customer_house_no: string;
  customer_moo: string;
  customer_soi: string;
  customer_road: string;
  cusyomer_subdistrict: string;
  customer_district: string;
  customer_province: string;
};

type PowerOfAttorneyTouchKey = "customerName" | "plateNo" | keyof PowerOfAttorneyExtraData;

const DEFAULT_TEMPORARY_RECEIPT_EXTRAS: TemporaryReceiptExtraData = {
  row3NetPriceNote: "",
  row1Note: "",
  row3Note: "",
  bookingDate: "",
  depositDate: "",
  line2Discount: "",
  line4Installment: "",
  line5DownPayment: "",
  line6Amount: "",
  line7Amount: "",
  line8Amount: "",
  line9Amount: "",
  line10Amount: "",
  line11Amount: "",
  line12Amount: "",
  line13Amount: "",
  line14Amount: "",
  line6Status: "none",
  line7Status: "none",
  line8Status: "none",
  line9Status: "none",
  line10Status: "none",
  line11Status: "none",
  line12Status: "none",
  line13Status: "none",
  line14Status: "none"
};

const DEFAULT_POWER_OF_ATTORNEY_EXTRAS: PowerOfAttorneyExtraData = {
  purpose: "มอบอำนาจรับรถแทน",
  customer_age: "",
  customer_race: "",
  customer_nationality: "",
  customer_house_no: "",
  customer_moo: "",
  customer_soi: "",
  customer_road: "",
  cusyomer_subdistrict: "",
  customer_district: "",
  customer_province: ""
};

const POWER_OF_ATTORNEY_ADDRESS_KEYS = [
  "customer_house_no",
  "customer_moo",
  "customer_soi",
  "customer_road",
  "cusyomer_subdistrict",
  "customer_district",
  "customer_province"
] as const;

function isNamedPdfField(name: string) {
  return !/^fill_\d+$/i.test(name) && !/^undefined_\d+$/i.test(name);
}

const editableFieldOrder: Array<keyof ResolvedDocumentV2Data> = [
  "contractDate",
  "contractDateDay",
  "contractDateMonth",
  "contractDateYear",
  "currentDate",
  "currentDateDay",
  "currentDateMonth",
  "currentDateYear",
  "customerName",
  "customerAddress",
  "idCard",
  "phone",
  "plateNo",
  "brand",
  "model",
  "year",
  "color",
  "engineNo",
  "chassisNo",
  "bookingNo",
  "sellPrice",
  "deposit",
  "remainingAmount",
  "financeCompany",
  "saleName",
  "approverName"
];

const mappingOptions: Array<{ key: DocumentV2FieldKey; label: string }> = [
  { key: "contractDate", label: "วันที่สัญญา" },
  { key: "contractDateDay", label: "วันที่สัญญา (วัน)" },
  { key: "contractDateMonth", label: "วันที่สัญญา (เดือน)" },
  { key: "contractDateYear", label: "วันที่สัญญา (ปี)" },
  { key: "currentDate", label: "วันที่ปัจจุบัน" },
  { key: "currentDateDay", label: "วันที่ปัจจุบัน (วัน)" },
  { key: "currentDateMonth", label: "วันที่ปัจจุบัน (เดือน)" },
  { key: "currentDateYear", label: "วันที่ปัจจุบัน (ปี)" },
  { key: "customerName", label: "ชื่อลูกค้า" },
  { key: "customerAddress", label: "ที่อยู่ลูกค้า" },
  { key: "idCard", label: "เลขบัตรประชาชน" },
  { key: "phone", label: "เบอร์โทร" },
  { key: "plateNo", label: "ทะเบียน" },
  { key: "brand", label: "ยี่ห้อรถ" },
  { key: "model", label: "รุ่นรถ" },
  { key: "year", label: "ปีรถ" },
  { key: "color", label: "สี" },
  { key: "engineNo", label: "เลขเครื่อง" },
  { key: "chassisNo", label: "เลขตัวถัง" },
  { key: "bookingNo", label: "เลขที่ใบจอง" },
  { key: "sellPrice", label: "ราคาขาย" },
  { key: "deposit", label: "เงินจอง" },
  { key: "remainingAmount", label: "ยอดคงเหลือ" },
  { key: "financeCompany", label: "ไฟแนนซ์" },
  { key: "saleName", label: "ชื่อเซลล์" },
  { key: "approverName", label: "ผู้อนุมัติ" }
];

const keyLabel: Record<DocumentV2FieldKey, string> = Object.fromEntries(
  mappingOptions.map((m) => [m.key, m.label])
) as Record<DocumentV2FieldKey, string>;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Request failed");
    }
    throw new Error("Request failed");
  }
  if (contentType.includes("application/json")) return response.json();
  return (await response.blob()) as T;
}

function safeFilePart(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function downloadObjectUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatDatePartValue(value: string, fallback: string) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw;
}

function thaiNumberToWords(input: number) {
  if (!Number.isFinite(input)) return "";
  const rounded = Math.round(input * 100) / 100;
  const integerPart = Math.floor(Math.abs(rounded));
  const satangPart = Math.round((Math.abs(rounded) - integerPart) * 100);
  const unitWords = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];

  function convertChunk(n: number): string {
    if (n === 0) return "";
    let result = "";
    const chars = String(n).split("");
    for (let i = 0; i < chars.length; i++) {
      const digit = Number(chars[i]);
      const pos = chars.length - i - 1;
      if (digit === 0) continue;
      if (pos === 0) {
        if (digit === 1 && chars.length > 1) result += "เอ็ด";
        else result += digits[digit];
      } else if (pos === 1) {
        if (digit === 1) result += "สิบ";
        else if (digit === 2) result += "ยี่สิบ";
        else result += `${digits[digit]}สิบ`;
      } else {
        result += `${digits[digit]}${unitWords[pos]}`;
      }
    }
    return result;
  }

  function convertInteger(n: number): string {
    if (n === 0) return "ศูนย์";
    let remaining = n;
    let result = "";
    const million = 1_000_000;
    const chunks: number[] = [];
    while (remaining > 0) {
      chunks.unshift(remaining % million);
      remaining = Math.floor(remaining / million);
    }
    chunks.forEach((chunk, index) => {
      if (chunk === 0) return;
      const chunkText = convertChunk(chunk);
      if (index > 0) {
        result += chunkText ? `${chunkText}ล้าน` : "ล้าน";
      } else {
        result += chunkText;
      }
    });
    return result || "ศูนย์";
  }

  const integerText = convertInteger(integerPart);
  if (satangPart === 0) return `${integerText}บาทถ้วน`;
  const satangText = convertInteger(satangPart);
  return `${integerText}บาท${satangText}สตางค์`;
}

export function DocumentGeneratorV2() {
  const templates = getDocumentV2Templates();
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [pngUrl, setPngUrl] = useState("");
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [pngFileName, setPngFileName] = useState("document-v2.png");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [templateId, setTemplateId] = useState<DocumentV2TemplateId>(DOC_V2_TEMPLATE_ID);
  const [loadedTemplateFile, setLoadedTemplateFile] = useState("");
  const [debug, setDebug] = useState<FieldsDebug | null>(null);
  const [isTemplateReady, setIsTemplateReady] = useState(false);
  const [mapping, setMapping] = useState<DocumentV2FieldMapping>({});
  const [probeField, setProbeField] = useState("");
  const [probeValue, setProbeValue] = useState("TEST-123");
  const reportSource: "sales" = "sales";
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [resolvedData, setResolvedData] = useState<ResolvedDocumentV2Data | null>(null);
  const [editableData, setEditableData] = useState<ResolvedDocumentV2Data | null>(null);
  const [editableTouched, setEditableTouched] = useState(false);
  const [temporaryReceiptExtras, setTemporaryReceiptExtras] = useState<TemporaryReceiptExtraData>(DEFAULT_TEMPORARY_RECEIPT_EXTRAS);
  const [powerOfAttorneyExtras, setPowerOfAttorneyExtras] = useState<PowerOfAttorneyExtraData>(DEFAULT_POWER_OF_ATTORNEY_EXTRAS);
  const powerOfAttorneyTouchedRef = useRef<Record<string, boolean>>({});
  const [resolveDebug, setResolveDebug] = useState<DocumentV2ResolveDebug | null>(null);
  const [resolvingData, setResolvingData] = useState(false);
  const [settingsMode, setSettingsMode] = useState(false);
  const isHydratingMappingRef = useRef(false);

  const selectedTemplate = documentTemplatesV2[templateId];
  const isMappingLocked = Boolean(selectedTemplate.mappingLocked);
  const isDev = process.env.NODE_ENV === "development";

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );
  const sampleData = useMemo(() => editableData || resolvedData || mapBookingToDocumentV2(selectedReport), [editableData, resolvedData, selectedReport]);
  const rawReportData = useMemo(
    () => ({
      ...Object.fromEntries(Object.entries((selectedReport || {}) as Record<string, unknown>).map(([k, v]) => [k, v == null ? "" : String(v)])),
      ...(resolvedData || {}),
      ...(templateId === "power-of-attorney"
        ? {
            customer_age: powerOfAttorneyExtras.customer_age,
            customer_race: powerOfAttorneyExtras.customer_race,
            customer_nationality: powerOfAttorneyExtras.customer_nationality,
            customer_house_no: powerOfAttorneyExtras.customer_house_no,
            customer_moo: powerOfAttorneyExtras.customer_moo,
            customer_soi: powerOfAttorneyExtras.customer_soi,
            customer_road: powerOfAttorneyExtras.customer_road,
            cusyomer_subdistrict: powerOfAttorneyExtras.cusyomer_subdistrict,
            customer_district: powerOfAttorneyExtras.customer_district,
            customer_province: powerOfAttorneyExtras.customer_province,
            vehicle_plate: composePowerOfAttorneyVehiclePlate((editableData || sampleData || {}).plateNo, powerOfAttorneyExtras.purpose)
          }
        : {})
    }),
    [editableData, powerOfAttorneyExtras, resolvedData, sampleData, selectedReport, templateId]
  );
  const reportRawKeys = useMemo(() => Object.keys(rawReportData).sort((a, b) => a.localeCompare(b)), [rawReportData]);
  const namedFields = useMemo(() => fields.filter((field) => isNamedPdfField(field.name)), [fields]);
  const unnamedFields = useMemo(() => fields.filter((field) => !isNamedPdfField(field.name)), [fields]);
  const mappedFieldCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping]
  );
  const mappedNonEmptyCount = useMemo(() => {
    const rawLookup = rawReportData as Record<string, unknown>;
    return Object.entries(mapping).reduce((acc, [, key]) => {
      if (!key) return acc;
      const value = String(key).startsWith("raw:")
        ? rawLookup[String(key).slice(4)]
        : (sampleData as Record<string, unknown>)[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return acc + 1;
      return acc;
    }, 0);
  }, [mapping, rawReportData, sampleData]);
  const canRunGenerate = isTemplateReady && reportsLoaded && Boolean(selectedReport) && !resolvingData;

  function resetEditableData(next?: ResolvedDocumentV2Data | null) {
    setEditableData(next || resolvedData || mapBookingToDocumentV2(selectedReport));
    setEditableTouched(false);
    setTemporaryReceiptExtras(DEFAULT_TEMPORARY_RECEIPT_EXTRAS);
    setPowerOfAttorneyExtras(DEFAULT_POWER_OF_ATTORNEY_EXTRAS);
    powerOfAttorneyTouchedRef.current = {};
  }

  function updateTemporaryReceiptExtra<K extends keyof TemporaryReceiptExtraData>(key: K, value: TemporaryReceiptExtraData[K]) {
    setTemporaryReceiptExtras((prev) => ({ ...prev, [key]: value }));
  }

  function updatePowerOfAttorneyExtra<K extends keyof PowerOfAttorneyExtraData>(key: K, value: PowerOfAttorneyExtraData[K]) {
    powerOfAttorneyTouchedRef.current[String(key)] = true;
    setPowerOfAttorneyExtras((prev) => ({ ...prev, [key]: value }));
  }

  function applyPowerOfAttorneySuggestion(suggestion: PowerOfAttorneySuggestion) {
    if (templateId !== "power-of-attorney") return;
    const current = (editableData || sampleData || {}) as Record<string, string>;
    const nextEditableData = { ...(editableData || sampleData || {}) } as ResolvedDocumentV2Data;

    if (suggestion.customerName && !powerOfAttorneyTouchedRef.current.customerName && !String(current.customerName || "").trim()) {
      nextEditableData.customerName = suggestion.customerName;
      setEditableData(nextEditableData);
      setEditableTouched(true);
    }
    if (suggestion.plateNo && !powerOfAttorneyTouchedRef.current.plateNo && !String(current.plateNo || "").trim()) {
      nextEditableData.plateNo = suggestion.plateNo;
      setEditableData(nextEditableData);
      setEditableTouched(true);
    }

    setPowerOfAttorneyExtras((prev) => {
      const next = { ...prev };
      for (const key of POWER_OF_ATTORNEY_ADDRESS_KEYS) {
        const value = suggestion[key];
        if (!value || powerOfAttorneyTouchedRef.current[key] || String(next[key]).trim()) continue;
        next[key] = value;
      }
      return next;
    });
  }

  function autoSplitPowerOfAttorneyAddress(address: string) {
    if (templateId !== "power-of-attorney") return;
    applyPowerOfAttorneySuggestion({
      ...splitPowerOfAttorneyAddress(address),
      address
    });
  }

  function computeNetSellPrice() {
    const sellPriceText = String((editableData || sampleData || {}).sellPrice || "");
    const base = Number(sellPriceText.replace(/,/g, "").replace(/[^\d.-]/g, ""));
    const discount = Number(String(temporaryReceiptExtras.line2Discount || "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(base)) return "";
    const net = Number.isFinite(discount) ? Math.max(base - discount, 0) : base;
    return net > 0 ? net.toLocaleString("th-TH") : "";
  }

  function computeRemainingAmountThaiText() {
    const currentTotal = String((editableData || sampleData || {}).remainingAmount || "");
    const normalized = currentTotal.replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!normalized) return String((sampleData || {}).remainingAmountThaiText || "");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return String((sampleData || {}).remainingAmountThaiText || "");
    return parsed > 0 ? thaiNumberToWords(parsed) : "";
  }

  function buildGeneratePayload() {
    const payload = {
      ...(editableData || sampleData || {}),
      ...temporaryReceiptExtras
    } as Record<string, string>;
    payload.remainingAmountThaiText = computeRemainingAmountThaiText();
    if (templateId === "power-of-attorney") {
      payload.customer_age = powerOfAttorneyExtras.customer_age || "";
      payload.customer_race = powerOfAttorneyExtras.customer_race || "";
      payload.customer_nationality = powerOfAttorneyExtras.customer_nationality || "";
      payload.customer_house_no = powerOfAttorneyExtras.customer_house_no || "";
      payload.customer_moo = powerOfAttorneyExtras.customer_moo || "";
      payload.customer_soi = powerOfAttorneyExtras.customer_soi || "";
      payload.customer_road = powerOfAttorneyExtras.customer_road || "";
      payload.cusyomer_subdistrict = powerOfAttorneyExtras.cusyomer_subdistrict || "";
      payload.customer_district = powerOfAttorneyExtras.customer_district || "";
      payload.customer_province = powerOfAttorneyExtras.customer_province || "";
      payload.vehicle_plate = composePowerOfAttorneyVehiclePlate((editableData || sampleData || {}).plateNo, powerOfAttorneyExtras.purpose);
    }
    payload.row3NetPriceNote = temporaryReceiptExtras.row3NetPriceNote || "";
    payload.row1Note = temporaryReceiptExtras.row1Note || "";
    payload.row3Note = temporaryReceiptExtras.row3Note || "";
    payload.bookingDate = temporaryReceiptExtras.bookingDate || "";
    payload.depositDate = temporaryReceiptExtras.depositDate || "";
    return payload;
  }

  async function loadFields() {
    try {
      setError("");
      setIsTemplateReady(false);
      const res = await api<{
        ok: boolean;
        fields: FieldItem[];
        templateId?: string;
        templateFile?: string;
        debug?: FieldsDebug;
      }>(`/api/documents-v2/fields?templateId=${encodeURIComponent(templateId)}`);
      setFields(res.fields || []);
      setLoadedTemplateFile(String(res.templateFile || selectedTemplate.fileName));
      setDebug(res.debug || null);
      if (!res.fields?.length) {
        setError("ไม่พบ AcroForm fields ในไฟล์นี้");
        return;
      }
      try {
        const mappingRes = await api<{ ok: boolean; mapping: DocumentV2FieldMapping }>(`/api/documents-v2/mapping?templateId=${encodeURIComponent(templateId)}`);
        setMapping(mappingRes.mapping || {});
        setSaveState("saved");
        setLastSavedAt(new Date().toLocaleTimeString("th-TH"));
      } catch {}
      setIsTemplateReady(true);
    } catch (e) {
      setFields([]);
      setLoadedTemplateFile(selectedTemplate.fileName);
      const message = e instanceof Error ? e.message : "โหลด fields ไม่สำเร็จ";
      setError(message);
      setIsTemplateReady(false);
    }
  }

  async function loadReports() {
    setError("");
    setReportsLoaded(false);
    const res = await api<{ reports: ReportHistoryItem[] }>(`/api/reports/history?type=${reportSource}`);
    const all = res.reports || [];
    const filtered = all.filter((r) => {
      const typeOk = String(r.type || "").toLowerCase() === reportSource;
      const hasCore = Boolean(String(r.customerName || "").trim() || String(r.plate || "").trim());
      return typeOk || hasCore;
    });
    setReports(filtered);
    setSelectedReportId(filtered[0]?.id || "");
    setPreviewUrl("");
    setPngUrl("");
    setPngBlob(null);
    setReportsLoaded(true);
    if (!filtered.length) {
      setError("ไม่พบรายงานขายในระบบ");
    }
  }

  async function loadResolvedData(report: ReportHistoryItem | null) {
    if (!report) {
      setResolvedData(null);
      setResolveDebug(null);
      return;
    }
    try {
      setResolvingData(true);
      const res = await api<{ ok: boolean; data: ResolvedDocumentV2Data; debug: DocumentV2ResolveDebug }>("/api/documents-v2/resolve-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, templateId })
      });
      setResolvedData(res.data || null);
      if (!editableTouched) setEditableData(res.data || null);
      setResolveDebug(res.debug || null);
    } catch (e) {
      setResolvedData(mapBookingToDocumentV2(report) as ResolvedDocumentV2Data);
      if (!editableTouched) setEditableData(mapBookingToDocumentV2(report) as ResolvedDocumentV2Data);
      setResolveDebug(null);
      setError(e instanceof Error ? e.message : "โหลดข้อมูลที่จะใช้จริงไม่สำเร็จ");
    } finally {
      setResolvingData(false);
    }
  }

  useEffect(() => {
    loadResolvedData(selectedReport);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId, templateId]);

  useEffect(() => {
    setPreviewUrl("");
    if (pngUrl) URL.revokeObjectURL(pngUrl);
    setPngUrl("");
    setPngBlob(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, selectedReportId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSettingsMode(new URLSearchParams(window.location.search).get("mode") === "settings");
    }
  }, []);

  useEffect(() => {
    if (templates.length && !documentTemplatesV2[templateId]) {
      setTemplateId(templates[0].id);
    }
  }, [templates, templateId]);

  useEffect(() => {
    if (!fields.length && templates.length) {
      loadFields();
    }
    if (!reportsLoaded) {
      loadReports();
    }
    if (!Object.keys(mapping).length) {
      loadMapping();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  useEffect(() => {
    if (!editableTouched) {
      setEditableData(resolvedData || mapBookingToDocumentV2(selectedReport));
    }
  }, [resolvedData, selectedReport, editableTouched]);

  useEffect(() => {
    if (templateId !== "power-of-attorney") return;
    const reportAddress = String((editableData || sampleData || {}).customerAddress || "").trim();
    if (!reportAddress) return;
    autoSplitPowerOfAttorneyAddress(reportAddress);
  }, [editableData, sampleData, templateId]);

  useEffect(() => {
    powerOfAttorneyTouchedRef.current = {};
    setPowerOfAttorneyExtras(DEFAULT_POWER_OF_ATTORNEY_EXTRAS);
  }, [templateId, selectedReportId]);

  useEffect(() => {
    if (canRunGenerate && !previewUrl) {
      preview().catch(() => undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRunGenerate, previewUrl, templateId, selectedReportId]);

  async function loadMapping() {
    try {
      isHydratingMappingRef.current = true;
      const res = await api<{ ok: boolean; mapping: DocumentV2FieldMapping }>(`/api/documents-v2/mapping?templateId=${encodeURIComponent(templateId)}`);
      setMapping(res.mapping || {});
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString("th-TH"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลด mapping ไม่สำเร็จ");
      setSaveState("error");
    } finally {
      setTimeout(() => {
        isHydratingMappingRef.current = false;
      }, 0);
    }
  }

  async function saveMapping() {
    try {
      setError("");
      setSaveState("saving");
      await api<{ ok: boolean; mapping: DocumentV2FieldMapping }>("/api/documents-v2/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, mapping })
      });
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString("th-TH"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึก mapping ไม่สำเร็จ");
      setSaveState("error");
    }
  }

  useEffect(() => {
    if (isMappingLocked) return;
    if (isHydratingMappingRef.current) return;
    if (Object.keys(mapping).length === 0) return;
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
    const timer = setTimeout(() => {
      saveMapping();
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMappingLocked, mapping, templateId]);

  async function generatePdfBlob() {
    if (!isTemplateReady) {
      setError("ไม่พบ AcroForm fields ในไฟล์นี้");
      return null;
    }
    if (!selectedReport) {
      setError("กรุณาโหลดและเลือกรายงานขายก่อน Preview");
      return null;
    }
    if (!reportsLoaded) {
      setError("กรุณาโหลดรายงานขายก่อน");
      return null;
    }
    try {
      setLoading(true);
      setError("");
      const payloadData = buildGeneratePayload();
      return await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport, templateId, data: payloadData })
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview ไม่สำเร็จ");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function refreshDocumentPreviews() {
    const blob = await generatePdfBlob();
    if (!blob) return null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const pdfUrl = URL.createObjectURL(blob);
    setPreviewUrl(pdfUrl);

    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas ไม่พร้อม");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    await page.render({ canvasContext: ctx, viewport }).promise;
    const nextPngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!nextPngBlob) throw new Error("แปลง PNG ไม่สำเร็จ");
    if (pngUrl.startsWith("blob:")) URL.revokeObjectURL(pngUrl);
    const fileBase = [
      "sale-contract",
      safeFilePart(sampleData.customerName),
      safeFilePart(sampleData.plateNo)
    ].filter(Boolean).join("-");
    const fileName = `${fileBase || "document-v2"}.png`;
    const nextPngUrl = URL.createObjectURL(nextPngBlob);
    setPngUrl(nextPngUrl);
    setPngBlob(nextPngBlob);
    setPngFileName(fileName);
    return { pdfUrl, nextPngUrl, nextPngBlob, fileName };
  }

  async function preview() {
    return refreshDocumentPreviews();
  }

  async function previewProbe() {
    if (!isTemplateReady || !probeField || !probeValue) {
      setError("กรอก Field และค่า TEST ก่อน");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const payloadData = buildGeneratePayload();
      const blob = await api<Blob>("/api/documents-v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: selectedReport, templateId, data: payloadData, fieldProbeName: probeField, fieldProbeValue: probeValue })
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview Probe ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function exportPng() {
    if (pngBlob && pngUrl) {
      const file = new File([pngBlob], pngFileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          files: [file],
          title: "สัญญาซื้อขายรถยนต์",
          text: "เอกสาร PNG จาก BIG CAR CRM"
        });
        return;
      }
      downloadObjectUrl(pngUrl, pngFileName);
      return;
    }
    if (!isTemplateReady) {
      setError("ไม่พบ AcroForm fields ในไฟล์นี้");
      return;
    }
    if (!selectedReport) {
      setError("กรุณาโหลดและเลือกรายงานขายก่อน Export");
      return;
    }
    if (!reportsLoaded) {
      setError("กรุณาโหลดรายงานขายก่อน");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const refreshed = await refreshDocumentPreviews();
      if (refreshed?.nextPngUrl) {
        downloadObjectUrl(refreshed.nextPngUrl, refreshed.fileName);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export PNG ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function updateEditableField(key: keyof ResolvedDocumentV2Data, value: string) {
    if (templateId === "power-of-attorney" && (key === "customerName" || key === "plateNo")) {
      powerOfAttorneyTouchedRef.current[String(key)] = true;
    }
    setEditableTouched(true);
    setEditableData((prev) => ({
      ...(prev || sampleData || {}),
      [key]: value
    } as ResolvedDocumentV2Data));
  }

  async function sharePng() {
    if (!pngBlob) {
      setError("ยังไม่มีไฟล์ PNG กรุณากดเซฟ PNG ก่อน");
      return;
    }
    try {
      const file = new File([pngBlob], pngFileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          files: [file],
          title: "สัญญาซื้อขายรถยนต์",
          text: "เอกสาร PNG จาก BIG CAR CRM"
        });
        return;
      }
      if (pngUrl) window.open(pngUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "แชร์/บันทึกรูปไม่สำเร็จ");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 text-white">
      <h1 className="text-2xl font-bold">DocumentGeneratorV2</h1>
      <p className="text-sm text-gray-300">AcroForm only · ใช้ไฟล์เดียวกันทั้ง Load Fields + Preview/Export</p>
      {error ? <div className="rounded border border-red-500/40 bg-red-900/30 p-3 text-red-100">{error}</div> : null}

      <div className="rounded border border-white/10 p-3">
        <label className="mb-2 block text-sm">Template</label>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value as DocumentV2TemplateId);
            setFields([]);
            setDebug(null);
            setError("");
            setIsTemplateReady(false);
            setPreviewUrl("");
            if (pngUrl) URL.revokeObjectURL(pngUrl);
            setPngUrl("");
            setPngBlob(null);
          }}
          className="w-full rounded bg-black/40 p-2"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.fileName})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded border border-white/10 p-3">
        <label className="mb-2 block text-sm">เลือกรายงานขาย</label>
        <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)} className="w-full rounded bg-black/40 p-2">
          <option value="">-- เลือก --</option>
          {reports.map((r) => (
            <option key={r.id} value={r.id}>
              {r.customerName || "ไม่ระบุ"} · {r.plate || "ไม่ระบุ"} · {r.saleName || "ไม่ระบุ"}
            </option>
          ))}
        </select>
      </div>

      {settingsMode ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadFields} className="rounded bg-emerald-500 px-4 py-2 font-semibold text-black">โหลดรายชื่อ Fields</button>
            <button onClick={loadReports} className="rounded border border-white/20 px-4 py-2">โหลดรายงานขาย</button>
            <button onClick={loadMapping} className="rounded border border-white/20 px-4 py-2">โหลด Mapping</button>
            <button
              onClick={saveMapping}
              disabled={saveState === "saving" || isMappingLocked}
              className={`rounded border px-4 py-2 ${saveState === "saving" ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/20"}`}
            >
              {isMappingLocked ? "Mapping ล็อกแล้ว" : saveState === "saving" ? "กำลังบันทึก..." : saveState === "saved" ? "บันทึกแล้ว" : saveState === "error" ? "บันทึกล้มเหลว" : "บันทึก Mapping"}
            </button>
            <button onClick={preview} disabled={loading || !canRunGenerate} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50">{loading ? <Loader2 className="inline animate-spin" size={16} /> : <Eye className="inline" size={16} />} Preview เอกสาร</button>
            <button onClick={previewProbe} disabled={loading} className="rounded border border-yellow-300/40 px-4 py-2 text-yellow-200">ทดสอบ Field</button>
            <button onClick={preview} disabled={loading || !canRunGenerate} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50"><ImageIcon className="inline" size={16} /> อัปเดตเอกสาร</button>
          </div>
          <p className="text-xs text-gray-300">กดเพื่ออัปเดต Preview / PDF ตามข้อมูลที่แก้ด้านล่าง</p>
          <div className="text-xs text-gray-300 space-y-1">
            <div>
              สถานะ Mapping: {isMappingLocked ? "ล็อกสำหรับ PDF สัญญาซื้อขายรถยนต์" : saveState === "dirty" ? "มีการแก้ไข (รอบันทึกอัตโนมัติ)" : saveState === "saving" ? "กำลังบันทึก..." : saveState === "saved" ? "บันทึกแล้ว" : saveState === "error" ? "บันทึกล้มเหลว" : "ยังไม่เริ่ม"} {lastSavedAt && !isMappingLocked ? `· ล่าสุด ${lastSavedAt}` : ""}
            </div>
            <div>
              ความพร้อมข้อมูล: แมพแล้ว {mappedFieldCount} ช่อง · มีข้อมูลจริง {mappedNonEmptyCount} ช่อง
            </div>
            {!canRunGenerate ? (
              <div className="text-amber-300">
                ยัง Preview/Export ไม่ได้: {!isTemplateReady ? "ยังไม่พร้อม template" : !reportsLoaded ? "ยังไม่โหลดรายงานขาย" : !selectedReport ? "ยังไม่เลือกรายงานขาย" : resolvingData ? "กำลังดึงข้อมูลจริงจากทะเบียน" : saveState === "saving" || saveState === "dirty" ? "กำลังบันทึก mapping" : "รอข้อมูล"}
              </div>
            ) : null}
          </div>

          <div className="rounded border border-emerald-400/20 bg-emerald-500/5 p-3">
            <h2 className="mb-2 font-semibold">ข้อมูลที่จะใช้จริง</h2>
            {resolvingData ? (
              <p className="text-sm text-emerald-200">กำลังดึงข้อมูลจากรายงานขายและสต็อกตามทะเบียน...</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                <div className="rounded bg-black/30 p-2">ทะเบียน: {sampleData.plateNo || "ไม่มีข้อมูล"}</div>
                <div className="rounded bg-black/30 p-2">เลขเครื่อง: {sampleData.engineNo || "ไม่มีข้อมูล"}</div>
                <div className="rounded bg-black/30 p-2">เลขตัวถัง: {sampleData.chassisNo || "ไม่มีข้อมูล"}</div>
                <div className="rounded bg-black/30 p-2">ที่อยู่: {sampleData.customerAddress || "ไม่มีข้อมูล"}</div>
              </div>
            )}
            {resolveDebug ? (
              <p className="mt-2 text-xs text-gray-400">
                Stock lookup: {resolveDebug.stockFound ? "พบรถ" : "ไม่พบรถ"} · engine={resolveDebug.resolvedEngineNo || "-"} · chassis={resolveDebug.resolvedChassisNo || "-"}
              </p>
            ) : null}
          </div>

          <div className="rounded border border-white/10 p-3">
            <h2 className="mb-2 font-semibold">Field Probe</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                value={probeField}
                onChange={(e) => setProbeField(e.target.value)}
                placeholder="เช่น Text1"
                className="rounded bg-black/40 p-2 text-sm"
              />
              <input
                value={probeValue}
                onChange={(e) => setProbeValue(e.target.value)}
                placeholder="ค่าทดสอบ"
                className="rounded bg-black/40 p-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded border border-white/10 p-3">
            <h2 className="mb-2 font-semibold">Field Mapping</h2>
            {isMappingLocked ? (
              <p className="mb-3 rounded border border-emerald-400/20 bg-emerald-500/10 p-2 text-sm text-emerald-100">
                PDF นี้ล็อก Mapping แล้ว เพื่อไม่ให้ตำแหน่ง/ช่องที่ตั้งไว้ขยับโดยไม่ตั้งใจ
              </p>
            ) : null}
            {!fields.length ? (
              <p className="text-sm text-gray-400">กดโหลดรายชื่อ Fields ก่อน</p>
            ) : (
              <div className="space-y-2">
                {fields.map((f) => (
                  <div key={f.name} className="grid grid-cols-2 gap-2">
                    <div className="rounded bg-black/30 p-2 text-sm">{f.name}</div>
                    <div className="space-y-1">
                      <select
                        value={mapping[f.name] || ""}
                        disabled={isMappingLocked}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [f.name]: e.target.value as DocumentV2MappedValue }))}
                        className="w-full rounded bg-black/40 p-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">-- ไม่แมพ --</option>
                        {mappingOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                        {reportRawKeys.length ? <option value="" disabled>──────── รายงานขาย (raw) ────────</option> : null}
                        {reportRawKeys.map((rawKey) => (
                          <option key={`raw-${rawKey}`} value={`raw:${rawKey}`}>
                            raw: {rawKey}
                          </option>
                        ))}
                      </select>
                      {mapping[f.name] ? (
                        (() => {
                          const rawLookup = rawReportData as Record<string, unknown>;
                          return (
                        <div className="text-xs text-emerald-300">
                          {String(mapping[f.name]).startsWith("raw:")
                            ? `ตัวอย่าง (raw): ${String(mapping[f.name]).slice(4)} = ${String(rawLookup[String(mapping[f.name]).slice(4)] || "ไม่มีข้อมูล")}`
                            : `ตัวอย่าง: ${keyLabel[mapping[f.name] as DocumentV2FieldKey]} = ${String((sampleData as Record<string, unknown>)[mapping[f.name] as DocumentV2FieldKey] || "ไม่มีข้อมูล")}`}
                        </div>
                          );
                        })()
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {previewUrl ? (
        <div className="rounded border border-white/10 p-3">
          <h2 className="mb-2 font-semibold">Preview เอกสาร</h2>
          <p className="mb-2 text-xs text-gray-300">แสดงตัวอย่างเอกสารตามข้อมูลล่าสุด หากแก้ข้อมูลด้านล่าง ให้กด “อัปเดตเอกสาร” ก่อน Download PDF</p>
          <div
            className="max-h-[78svh] overflow-auto rounded bg-white"
            style={{ touchAction: "pan-x pan-y pinch-zoom", WebkitOverflowScrolling: "touch" }}
          >
            <iframe src={previewUrl} className="h-[78svh] w-full rounded bg-white" />
          </div>
          <a href={previewUrl} download={loadedTemplateFile || selectedTemplate.fileName || "document-v2.pdf"} className="mt-2 inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 font-semibold text-black">
            <Download size={16} /> Download PDF ตาม Preview นี้
          </a>
        </div>
      ) : null}

      {!settingsMode ? (
        <>
          <div className="grid grid-cols-1 gap-2 rounded border border-white/10 p-3 sm:grid-cols-3">
            <button onClick={preview} disabled={loading || !canRunGenerate} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50">
              <ImageIcon className="inline" size={16} /> อัปเดตเอกสาร
            </button>
            <button onClick={exportPng} disabled={loading || !canRunGenerate} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50">
              <ImageIcon className="inline" size={16} /> ดาวน์โหลด PNG
            </button>
            <button
              onClick={sharePng}
              disabled={loading || !pngBlob}
              className="rounded border border-white/20 px-4 py-2 disabled:opacity-50"
            >
              <Share2 className="inline" size={16} /> แชร์/บันทึกรูป
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-300">กดเพื่ออัปเดต Preview / PDF ตามข้อมูลที่แก้ด้านล่าง</p>
          <p className="text-xs text-gray-300">บน iPhone ถ้าปุ่ม Download ไม่เข้า Photos ให้กด “แชร์/บันทึกรูป” แล้วเลือก Save Image</p>
        </>
      ) : null}

      {templateId === "temporary-receipt" || templateId === "power-of-attorney" ? (
        <div className="rounded border border-white/10 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">แก้ข้อมูลก่อน Preview</h2>
            <button
              type="button"
              onClick={() => resetEditableData()}
              className="rounded border border-white/20 px-3 py-1 text-sm"
            >
              รีเซ็ตข้อมูล
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-300">แตะช่องด้านล่างเพื่อแก้ค่าก่อนสร้าง Preview / PNG ได้เลย</p>
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1 md:col-span-2">
              <span className="block text-xs text-gray-300">วันที่ใบสั่งจอง</span>
              <input
                value={temporaryReceiptExtras.bookingDate}
                onChange={(e) => updateTemporaryReceiptExtra("bookingDate", e.target.value)}
                placeholder="22/06/2026"
                className="w-full rounded bg-black/40 p-2 text-sm"
              />
            </label>
            <label className="block space-y-1 md:col-span-2">
              <span className="block text-xs text-gray-300">วันที่ชำระเงินมัดจำ</span>
              <input
                value={temporaryReceiptExtras.depositDate}
                onChange={(e) => updateTemporaryReceiptExtra("depositDate", e.target.value)}
                placeholder="22/06/2026"
                className="w-full rounded bg-black/40 p-2 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {editableFieldOrder.map((key) => {
              const editableSource = (editableData || sampleData || {}) as Record<string, string>;
              const currentValue = String(editableSource[String(key)] || "");
              if (templateId === "power-of-attorney" && String(key) === "plateNo") {
                return null;
              }
              if (["sellPrice", "deposit", "remainingAmount"].includes(String(key))) {
                return null;
              }
              const isDatePart = String(key).endsWith("Day") || String(key).endsWith("Month") || String(key).endsWith("Year");
              const isDateHead = String(key) === "contractDate" || String(key) === "currentDate";
              if (isDatePart) {
                return null;
              }
              if (isDateHead) {
                const base = String(key).replace(/Date$/, "Date") as "contractDate" | "currentDate";
                const dayKey = `${base}Day` as keyof ResolvedDocumentV2Data;
                const monthKey = `${base}Month` as keyof ResolvedDocumentV2Data;
                const yearKey = `${base}Year` as keyof ResolvedDocumentV2Data;
                return (
                  <div key={key} className="space-y-1 md:col-span-2">
                    <span className="block text-xs text-gray-300">{keyLabel[key as DocumentV2FieldKey] || key}</span>
                    <div className="grid grid-cols-[1fr_auto_1fr_auto_1.4fr] items-center gap-2">
                      <input
                        value={formatDatePartValue(String(editableSource[String(dayKey)] || ""), "XX")}
                        onChange={(e) => updateEditableField(dayKey, e.target.value)}
                        placeholder="XX"
                        inputMode="numeric"
                        className="w-full min-w-0 rounded bg-black/40 p-2 text-center text-sm tracking-[0.25em]"
                      />
                      <span className="text-center text-xs text-gray-500">/</span>
                      <input
                        value={formatDatePartValue(String(editableSource[String(monthKey)] || ""), "XX")}
                        onChange={(e) => updateEditableField(monthKey, e.target.value)}
                        placeholder="XX"
                        inputMode="numeric"
                        className="w-full min-w-0 rounded bg-black/40 p-2 text-center text-sm tracking-[0.25em]"
                      />
                      <span className="text-center text-xs text-gray-500">/</span>
                      <input
                        value={formatDatePartValue(String(editableSource[String(yearKey)] || ""), "XXXX")}
                        onChange={(e) => updateEditableField(yearKey, e.target.value)}
                        placeholder="XXXX"
                        inputMode="numeric"
                        className="w-full min-w-0 rounded bg-black/40 p-2 text-center text-sm tracking-[0.25em]"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">แสดงเป็นวัน / เดือน / ปี แบบแยกช่อง เพื่อคุม layout ให้คงที่</p>
                  </div>
                );
              }
              return (
                <label key={key} className="space-y-1">
                  <span className="block text-xs text-gray-300">{keyLabel[key as DocumentV2FieldKey] || key}</span>
                  <input
                    value={currentValue}
                    onChange={(e) => updateEditableField(key, e.target.value)}
                    className="w-full rounded bg-black/40 p-2 text-sm"
                  />
                </label>
              );
            })}
          </div>
          {templateId === "power-of-attorney" ? (
            <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
              <h3 className="font-semibold">ข้อมูลหนังสือมอบอำนาจ</h3>
              <p className="mt-1 text-xs text-gray-300">ใช้เฉพาะตอน Preview / Generate PDF เท่านั้น</p>
              <div className="mt-3">
                <PowerOfAttorneyOcrScanner
                  currentName={String((editableData || sampleData || {}).customerName || "")}
                  reportAddress={String((editableData || sampleData || {}).customerAddress || "")}
                  onApply={applyPowerOfAttorneySuggestion}
                />
              </div>
              <div className="mt-2 rounded border border-white/10 bg-black/30 p-2 text-xs text-gray-300">
                <div className="font-medium text-gray-200">ที่อยู่จากรายงานขาย (อ้างอิงเท่านั้น)</div>
                <div className="mt-1 whitespace-pre-wrap break-words">{String((editableData || sampleData || {}).customerAddress || "ไม่มีข้อมูล")}</div>
                <div className="mt-1 text-[11px] text-gray-500">ระบบจะไม่แยกที่อยู่นี้ให้อัตโนมัติ ผู้ใช้กรอกบ้านเลขที่ / หมู่ / ซอย / ถนน / ตำบล / อำเภอ / จังหวัดเองได้</div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-1 md:col-span-2">
                  <span className="block text-xs text-gray-300">วัตถุประสงค์การมอบอำนาจ</span>
                  <select
                    value={powerOfAttorneyExtras.purpose}
                    onChange={(e) => updatePowerOfAttorneyExtra("purpose", e.target.value as PowerOfAttorneyPurpose)}
                    className="w-full rounded bg-black/40 p-2 text-sm"
                  >
                    <option value="มอบอำนาจรับรถแทน">มอบอำนาจรับรถแทน</option>
                    <option value="สำหรับโอนรถยนต์">สำหรับโอนรถยนต์</option>
                  </select>
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="block text-xs text-gray-300">ทะเบียนรถ</span>
                  <input
                    value={String((editableData || sampleData || {}).plateNo || "")}
                    onChange={(e) => updateEditableField("plateNo", e.target.value)}
                    placeholder="1ขอ 7063"
                    className="w-full rounded bg-black/40 p-2 text-sm"
                  />
                  <p className="text-[11px] text-gray-500">จะถูกเติมเป็น “{composePowerOfAttorneyVehiclePlate((editableData || sampleData || {}).plateNo, powerOfAttorneyExtras.purpose) || "มอบอำนาจรับรถแทน ทะเบียน ..."}” ใน field vehicle_plate</p>
                </label>
                {[
                  ["customer_age", "อายุ"],
                  ["customer_race", "เชื้อชาติ"],
                  ["customer_nationality", "สัญชาติ"],
                  ["customer_house_no", "บ้านเลขที่"],
                  ["customer_moo", "หมู่ที่"],
                  ["customer_soi", "ซอย"],
                  ["customer_road", "ถนน"],
                  ["cusyomer_subdistrict", "ตำบล/แขวง"],
                  ["customer_district", "อำเภอ/เขต"],
                  ["customer_province", "จังหวัด"]
                ].map(([key, label]) => (
                  <label key={key} className="block space-y-1">
                    <span className="block text-xs text-gray-300">{label}</span>
                      <input
                        value={powerOfAttorneyExtras[key as keyof PowerOfAttorneyExtraData] as string}
                      onChange={(e) => updatePowerOfAttorneyExtra(key as keyof PowerOfAttorneyExtraData, e.target.value)}
                      className="w-full rounded bg-black/40 p-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
            <h3 className="font-semibold">ข้อมูลเพิ่มเติมสำหรับใบเสร็จชั่วคราว</h3>
            <p className="mt-1 text-xs text-gray-300">ใช้เฉพาะตอน Preview / Generate PDF เท่านั้น</p>
            <div className="mt-3 space-y-4">
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ลำดับ 1 ราคาขายรถยนต์</span>
                <input
                  value={String((editableData || sampleData || {}).sellPrice || "")}
                  onChange={(e) => updateEditableField("sellPrice", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">หมายเหตุลำดับ 1</span>
                <input
                  value={temporaryReceiptExtras.row1Note}
                  onChange={(e) => updateTemporaryReceiptExtra("row1Note", e.target.value)}
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ลำดับ 3 ราคารถยนต์สุทธิ</span>
                <input
                  value={String((editableData || sampleData || {}).sellPrice || "")}
                  readOnly
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
                <p className="text-[11px] text-gray-500">ลำดับ 3 ใช้ค่าเดียวกับลำดับ 1 ตาม field PDF ปัจจุบัน</p>
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">หมายเหตุลำดับ 3</span>
                <input
                  value={temporaryReceiptExtras.row3Note}
                  onChange={(e) => updateTemporaryReceiptExtra("row3Note", e.target.value)}
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ลำดับ 2 ส่วนลดราคาขาย</span>
                <input
                  value={temporaryReceiptExtras.line2Discount}
                  onChange={(e) => updateTemporaryReceiptExtra("line2Discount", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ลำดับ 4 ยอดจัดสินเชื่อเช่าซื้อ</span>
                <input
                  value={temporaryReceiptExtras.line4Installment}
                  onChange={(e) => updateTemporaryReceiptExtra("line4Installment", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ลำดับ 5 เงินดาวน์</span>
                <input
                  value={temporaryReceiptExtras.line5DownPayment}
                  onChange={(e) => updateTemporaryReceiptExtra("line5DownPayment", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ลำดับ 15 เงินมัดจำ</span>
                <input
                  value={String((editableData || sampleData || {}).deposit || "")}
                  onChange={(e) => updateEditableField("deposit", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs text-gray-300">ยอดชำระเงินรวมทั้งสิ้น</span>
                <input
                  value={String((editableData || sampleData || {}).remainingAmount || "")}
                  onChange={(e) => updateEditableField("remainingAmount", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded bg-black/40 p-2 text-sm"
                />
              </label>

              {[ 
                { idx: 6, title: "ลำดับ 6 ค่าประกันภัยรถยนต์", amountKey: "line6Amount", statusKey: "line6Status" },
                { idx: 7, title: "ลำดับ 7 ค่าประกันชีวิต / ประกันสินเชื่อ", amountKey: "line7Amount", statusKey: "line7Status" },
                { idx: 8, title: "ลำดับ 8 ค่าประกันเครื่องเกียร์ (EW) ไฟแนนซ์", amountKey: "line8Amount", statusKey: "line8Status" },
                { idx: 9, title: "ลำดับ 9 ค่าประกันเครื่องเกียร์ (EW) อินทรา", amountKey: "line9Amount", statusKey: "line9Status" },
                { idx: 10, title: "ลำดับ 10 ค่าบริการโอนกรรมสิทธิ์เล่มทะเบียน", amountKey: "line10Amount", statusKey: "line10Status" },
                { idx: 11, title: "ลำดับ 11 ค่าปรับสภาพรถยนต์ตามมาตรฐาน", amountKey: "line11Amount", statusKey: "line11Status" },
                { idx: 12, title: "ลำดับ 12 ค่าล้างและทำสปารถยนต์", amountKey: "line12Amount", statusKey: "line12Status" },
                { idx: 13, title: "ลำดับ 13 ค่าขนส่งรถสไลด์", amountKey: "line13Amount", statusKey: "line13Status" },
                { idx: 14, title: "ลำดับ 14 ค่าอื่น ๆ ถ้ามี", amountKey: "line14Amount", statusKey: "line14Status" }
              ].map(({ idx, amountKey, statusKey }) => (
                <div key={idx} className="rounded border border-white/10 bg-black/20 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr]">
                    <label className="block space-y-1">
                      <span className="block text-xs text-gray-300">{[
                        "ลำดับ 6 ค่าประกันภัยรถยนต์",
                        "ลำดับ 7 ค่าประกันชีวิต / ประกันสินเชื่อ",
                        "ลำดับ 8 ค่าประกันเครื่องเกียร์ (EW) ไฟแนนซ์",
                        "ลำดับ 9 ค่าประกันเครื่องเกียร์ (EW) อินทรา",
                        "ลำดับ 10 ค่าบริการโอนกรรมสิทธิ์เล่มทะเบียน",
                        "ลำดับ 11 ค่าปรับสภาพรถยนต์ตามมาตรฐาน",
                        "ลำดับ 12 ค่าล้างและทำสปารถยนต์",
                        "ลำดับ 13 ค่าขนส่งรถสไลด์",
                        "ลำดับ 14 ค่าอื่น ๆ ถ้ามี"
                      ][idx - 6]}</span>
                      <input
                        value={temporaryReceiptExtras[amountKey as keyof TemporaryReceiptExtraData] as string}
                        onChange={(e) => updateTemporaryReceiptExtra(amountKey as keyof TemporaryReceiptExtraData, e.target.value)}
                        inputMode="numeric"
                        className="w-full rounded bg-black/40 p-2 text-sm"
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="block text-xs text-gray-300">ลำดับ {idx} สถานะ</span>
                      <div className="flex flex-wrap gap-3 rounded bg-black/30 p-2 text-sm">
                        {[
                          { value: "none", label: "ไม่เลือก" },
                          { value: "gift", label: "แถม" },
                          { value: "charge", label: "เรียกเก็บ" }
                        ].map((opt) => (
                          <label key={opt.value} className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`temporary-receipt-${statusKey}`}
                              checked={temporaryReceiptExtras[statusKey as keyof TemporaryReceiptExtraData] === opt.value}
                              onChange={() => updateTemporaryReceiptExtra(statusKey as keyof TemporaryReceiptExtraData, opt.value as TemporaryReceiptExtraStatus)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded border border-white/10 p-3">
        <p className="mb-2 text-xs text-gray-300">โหลดไฟล์จริง: {loadedTemplateFile || "-"}</p>
        {isDev && debug ? (
          <pre className="mb-2 max-h-40 overflow-auto text-xs text-emerald-200">
            {JSON.stringify(debug, null, 2)}
          </pre>
        ) : null}
        {fields.length ? (
          <div className="mb-2 rounded border border-emerald-400/20 bg-emerald-500/5 p-2 text-xs text-emerald-100">
            พบฟิลด์ทั้งหมด {fields.length} ช่อง · ฟิลด์ชื่อจริง {namedFields.length} ช่อง · field ที่อ่านได้จากฟอร์มนี้:{" "}
            {fields
              .filter((f) => ["Model_Year", "Color", "DATE_DAY", "DATE_month", "DATE_Year", "Brand"].includes(f.name))
              .map((f) => f.name)
              .join(", ") || "ยังไม่แสดงในชุดนี้"}
          </div>
        ) : null}
        {namedFields.length ? (
          <pre className="max-h-56 overflow-auto text-xs text-gray-300">{JSON.stringify(namedFields, null, 2)}</pre>
        ) : null}
        {unnamedFields.length ? (
          <details className="mt-2 rounded border border-white/10 bg-black/20 p-2 text-xs text-gray-400">
            <summary className="cursor-pointer">Unnamed widgets ({unnamedFields.length})</summary>
            <pre className="mt-2 max-h-56 overflow-auto text-xs text-gray-400">{JSON.stringify(unnamedFields, null, 2)}</pre>
          </details>
        ) : null}
      </div>

    </div>
  );
}

export default function DocumentsV2Page() {
  return <DocumentGeneratorV2 />;
}
