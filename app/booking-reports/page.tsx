"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clipboard,
  ClipboardList,
  Cloud,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Save,
  Send,
  Search
} from "lucide-react";
import { buildDefaultBookingSubject, renderBookingReport } from "@/lib/booking-report";
import { NativeAppHeader, NativeAppShell, NativeBadge, NativeButton, SectionCard, TopMenuButton } from "@/app/components/ui";
import { bookingLineGroupStorageKey, defaultSystemSettings, readSystemSettings } from "@/lib/client-settings";
import { normalizeCarYear } from "@/lib/format";
import { BookingReportOcrScanner } from "@/components/booking-reports/BookingReportOcrScanner";
import { useSalesProfile } from "@/lib/use-sales-profile";
import { appendBookingGmailSignature, appendBookingLineSignature } from "@/lib/sales-profile-signature";
import type { BookingAttachment, BookingAttachmentCategory, BookingReportInput, BuyerType, CustomerLookup, DriveAttachment, DriveUploadResult, LineGroup, SalesUser, StockVehicle } from "@/lib/types";
import { formatThaiReportDate } from "@/lib/booking-report-display";
import {
  blankBookingFinanceSigning,
  autofillFinancePriceFromStock,
  calculateFinanceAmountBeforeVat,
  formatFinanceMoney,
  renderBookingFinanceSigningPreview,
  type BookingFinanceSigningInput
} from "@/lib/booking-finance-signing";

type BookingDuplicatePrompt = {
  status: "duplicate_booking_confirmation_required";
  matches: Array<{
    bookingReportId: string;
    bookingDate: string;
    customerName: string;
    plate: string;
    salespersonDisplayName: string;
    status: string;
  }>;
  confirmationToken: string;
  requestId: string;
};

const defaultEmailTo = "RDDUsedcarBooked@segroup.co.th";
const defaultEmailCc = "rongsarit.s@tgh.co.th";
const defaultTeamName = "พี่ลีฟ";
const financeDraftStorageKey = "bigcar-booking-finance-signing-draft-v1";

function todayInBangkok() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const blankForm: BookingReportInput = {
  bookingDate: todayInBangkok(),
  customerName: "",
  idCard: "",
  phone: "",
  address: "",
  postalCode: "",
  buyerType: "individual",
  bookingPrice: "",
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  salePrice: "",
  finalPrice: "",
  finalPriceNote: "",
  discount: "",
  paymentType: "",
  source: "",
  ownership: "",
  project: "",
  campaign: "",
  saleName: "ฐากร",
  teamName: defaultTeamName,
  conditions: "",
  emailSubject: "",
  emailTo: defaultEmailTo,
  emailCc: defaultEmailCc,
  emailBcc: "",
  attachments: [],
  reportText: "",
  status: "draft"
};

const attachmentLabels: Array<{ key: BookingAttachmentCategory; label: string; hint: string }> = [
  { key: "bookingSlip", label: "รูปใบจอง", hint: "JPG, PNG, PDF" },
  { key: "bookingCondition", label: "รูปเงื่อนไขการจอง", hint: "JPG, PNG, PDF" },
  { key: "carPhoto", label: "รูปรถ", hint: "ใช้กล้องหลังได้" },
  { key: "idCard", label: "รูปบัตรประชาชน", hint: "OCR รอบนี้เป็น Preview" },
  { key: "companyCertificate", label: "รูปหนังสือรับรองบริษัท", hint: "จำเป็นเมื่อผู้ซื้อเป็นบริษัท" }
];

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function numericOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function isBookingAttachmentCategory(value: string): value is BookingAttachmentCategory {
  return attachmentLabels.some((item) => item.key === value);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

async function compressBookingImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  const image = new Image();
  const sourceUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
      image.src = sourceUrl;
    });
    const maxWidth = 2000;
    const scale = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return file;
    const safeName = file.name.replace(/\.[^.]+$/, "") || "booking-photo";
    return new File([blob], `${safeName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function fillIfEmpty(current: BookingReportInput, vehicle: StockVehicle): BookingReportInput {
  return {
    ...current,
    plate: current.plate || vehicle.plate,
    brand: current.brand || vehicle.brand,
    model: current.model || vehicle.model,
    year: current.year || normalizeCarYear(vehicle.year),
    color: current.color || vehicle.color,
    salePrice: current.salePrice || numericOnly(vehicle.salePrice),
    source: current.source || vehicle.source,
    ownership: current.ownership || vehicle.ownership,
    project: current.project || vehicle.project,
    campaign: current.campaign || vehicle.campaign
  };
}

export default function BookingReportsPage() {
  const { user: salesProfile } = useSalesProfile();
  const [form, setForm] = useState<BookingReportInput>(blankForm);
  const [attachmentFiles, setAttachmentFiles] = useState<Record<BookingAttachmentCategory, File[]>>({
    bookingSlip: [],
    bookingCondition: [],
    carPhoto: [],
    idCard: [],
    companyCertificate: []
  });
  const [selectedAttachmentCategory, setSelectedAttachmentCategory] = useState<BookingAttachmentCategory>("bookingSlip");
  const [lookupStatus, setLookupStatus] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savedReportId, setSavedReportId] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [uploadedAttachments, setUploadedAttachments] = useState<DriveAttachment[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [selectedLineGroupId, setSelectedLineGroupId] = useState("");
  const [sendingLine, setSendingLine] = useState(false);
  const [savingFinance, setSavingFinance] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<BookingDuplicatePrompt | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ report: BookingReportInput; requestId: string } | null>(null);
  const [confirmExceptionalCreate, setConfirmExceptionalCreate] = useState(false);
  const [eligibleSalesUsers, setEligibleSalesUsers] = useState<SalesUser[]>([]);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState("");
  const [stockVehicle, setStockVehicle] = useState<Pick<StockVehicle, "plate" | "salePrice"> | null>(null);
  const [finance, setFinance] = useState<BookingFinanceSigningInput>(blankBookingFinanceSigning);
  const reportBody = useMemo(
    () => renderBookingReport({ ...form, reportText: "" }),
    [form]
  );
  const gmailBody = useMemo(() => appendBookingGmailSignature(reportBody, salesProfile), [reportBody, salesProfile]);
  const lineBody = useMemo(() => appendBookingLineSignature(reportBody, salesProfile), [reportBody, salesProfile]);
  const companyWarning = form.buyerType === "company" && attachmentFiles.companyCertificate.length === 0;
  const canSelectOwner = salesProfile?.role === "admin" || salesProfile?.role === "super_admin";
  const selectedOwner = useMemo(
    () => eligibleSalesUsers.find((user) => user.id === selectedOwnerUserId) || null,
    [eligibleSalesUsers, selectedOwnerUserId]
  );
  const paymentMode = form.paymentType.includes("สด")
    ? "cash"
    : form.paymentType.includes("ไฟแนนซ์") || form.paymentType.toLowerCase().includes("finance")
      ? "finance"
      : "unset";
  const financeOwner = canSelectOwner ? selectedOwner : salesProfile;
  const financeAmount = useMemo(
    () => calculateFinanceAmountBeforeVat(finance.financePrice, finance.downPayment),
    [finance.downPayment, finance.financePrice]
  );
  const financePreview = useMemo(
    () => renderBookingFinanceSigningPreview({
      finance,
      customerName: form.customerName,
      plate: form.plate,
      brand: form.brand,
      model: form.model,
      year: form.year,
      teamName: form.teamName,
      owner: financeOwner,
      fallbackSaleName: form.saleName,
      stockVehicle
    }),
    [finance, financeOwner, form.brand, form.customerName, form.model, form.plate, form.saleName, form.teamName, form.year, stockVehicle]
  );

  useEffect(() => {
    const settings = readSystemSettings();
    const latest = window.localStorage.getItem("bigcar-booking-email");
    let saved: Partial<Pick<BookingReportInput, "emailTo" | "emailCc" | "emailBcc">> = {};
    if (latest) {
      try {
        saved = JSON.parse(latest) as Pick<BookingReportInput, "emailTo" | "emailCc" | "emailBcc">;
      } catch {
        window.localStorage.removeItem("bigcar-booking-email");
      }
    }
    setForm((current) => ({
      ...current,
      teamName: current.teamName || settings.defaultTeamName || defaultSystemSettings.defaultTeamName,
      emailTo: saved.emailTo?.trim() || settings.bookingEmailTo || defaultEmailTo,
      emailCc: saved.emailCc !== undefined ? saved.emailCc : settings.bookingEmailCc || defaultEmailCc,
      emailBcc: saved.emailBcc !== undefined ? saved.emailBcc : ""
    }));
  }, []);

  useEffect(() => {
    if (!salesProfile) return;
    setForm((current) => ({
      ...current,
      saleName: !current.saleName || current.saleName === blankForm.saleName ? salesProfile.firstName || current.saleName : current.saleName,
      teamName: !current.teamName ? defaultTeamName : current.teamName
    }));
  }, [salesProfile]);

  useEffect(() => {
    if (!canSelectOwner) {
      setEligibleSalesUsers([]);
      setSelectedOwnerUserId("");
      return;
    }
    readJson<{ users: SalesUser[] }>("/api/admin/users")
      .then(({ users }) => setEligibleSalesUsers(users.filter((user) => user.role === "sales" && !user.locked)))
      .catch(() => setEligibleSalesUsers([]));
  }, [canSelectOwner]);

  useEffect(() => {
    if (!canSelectOwner) return;
    setForm((current) => ({ ...current, saleName: selectedOwner?.firstName || selectedOwner?.nickname || "" }));
  }, [canSelectOwner, selectedOwner]);

  useEffect(() => {
    readJson<{ groups: LineGroup[] }>("/api/line/groups")
      .then((data) => {
        setLineGroups(data.groups);
        const savedGroupId = window.localStorage.getItem(bookingLineGroupStorageKey) || "";
        const groupId = data.groups.some((group) => group.groupId === savedGroupId)
          ? savedGroupId
          : data.groups[0]?.groupId || "";
        setSelectedLineGroupId(groupId);
      })
      .catch(() => setLineGroups([]));
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(financeDraftStorageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        finance?: Partial<BookingFinanceSigningInput>;
        paymentType?: string;
        savedReportId?: string;
      };
      setFinance({ ...blankBookingFinanceSigning, ...(parsed.finance || {}) });
      if (parsed.paymentType === "ไฟแนนซ์") setForm((current) => ({ ...current, paymentType: "ไฟแนนซ์" }));
      if (parsed.savedReportId) {
        setSavedReportId(parsed.savedReportId);
        readJson<{ metadata: (BookingFinanceSigningInput & { stockPrice: string; stockPlate: string }) | null }>(
          `/api/booking-reports/finance-signing?bookingReportId=${encodeURIComponent(parsed.savedReportId)}`
        ).then(({ metadata }) => {
          if (!metadata) return;
          setFinance({
            financeCompany: metadata.financeCompany,
            signingLocation: metadata.signingLocation,
            occupation: metadata.occupation,
            employmentDuration: metadata.employmentDuration,
            income: metadata.income,
            creditStatus: metadata.creditStatus,
            financePrice: metadata.financePrice || metadata.stockPrice || "",
            financePriceSource: metadata.financePriceSource || (metadata.stockPrice ? "stock" : ""),
            downPayment: metadata.downPayment
          });
          setStockVehicle(metadata.stockPrice ? { plate: metadata.stockPlate, salePrice: metadata.stockPrice } : null);
          if (metadata.stockPlate) setForm((current) => ({ ...current, plate: current.plate || metadata.stockPlate }));
        }).catch(() => undefined);
      }
    } catch {
      window.localStorage.removeItem(financeDraftStorageKey);
    }
  }, []);

  useEffect(() => {
    setFinance((current) => autofillFinancePriceFromStock(current, stockVehicle?.salePrice));
  }, [stockVehicle?.salePrice]);

  useEffect(() => {
    if (paymentMode !== "finance") return;
    const current = window.localStorage.getItem(financeDraftStorageKey);
    let draftId = "";
    try {
      draftId = current ? String((JSON.parse(current) as { draftId?: string }).draftId || "") : "";
    } catch {
      draftId = "";
    }
    window.localStorage.setItem(financeDraftStorageKey, JSON.stringify({
      draftId: draftId || crypto.randomUUID(),
      finance,
      paymentType: "ไฟแนนซ์",
      savedReportId
    }));
  }, [finance, paymentMode, savedReportId]);

  useEffect(() => {
    if (selectedLineGroupId) {
      window.localStorage.setItem(bookingLineGroupStorageKey, selectedLineGroupId);
    }
  }, [selectedLineGroupId]);

  useEffect(() => {
    setForm((current) => {
      return {
        ...current,
        emailSubject: buildDefaultBookingSubject(current)
      };
    });
  }, [form.plate]);

  useEffect(() => {
    const plate = form.plate.trim();
    if (plate.length < 3) {
      setStockVehicle(null);
      return;
    }
    setStockVehicle(null);

    const timeout = window.setTimeout(async () => {
      setLookupStatus("กำลังค้นหาสต๊อกจากทะเบียน...");
      try {
        const data = await readJson<{ vehicle: StockVehicle | null; warning?: string }>(
          `/api/stock/lookup?plate=${encodeURIComponent(plate)}`
        );

        if (data.vehicle) {
          setStockVehicle(data.vehicle);
          setForm((current) => fillIfEmpty(current, data.vehicle as StockVehicle));
          setLookupStatus(
            data.warning
              ? `พบข้อมูลสต๊อก แต่มีคำเตือน: ${data.warning}`
              : `พบข้อมูลสต๊อกทะเบียน ${plate} และเติมช่องที่ว่างแล้ว`
          );
        } else {
          setStockVehicle(null);
          setLookupStatus(
            data.warning
              ? `ค้นสต๊อกไม่สำเร็จ: ${data.warning}`
              : `ไม่พบทะเบียน ${plate} ในสต๊อกล่าสุด`
          );
        }
      } catch {
        setStockVehicle(null);
        setLookupStatus(`ค้นสต๊อกไม่สำเร็จสำหรับทะเบียน ${plate} แต่ฟอร์มยังใช้งานได้`);
      }
    }, 550);

    return () => window.clearTimeout(timeout);
  }, [form.plate]);

  useEffect(() => {
    const idCard = form.idCard.trim();
    if (idCard.length < 8) return;

    const timeout = window.setTimeout(async () => {
      try {
        const data = await readJson<{ customer: CustomerLookup }>(
          `/api/customers/lookup?idCard=${encodeURIComponent(idCard)}`
        );

        if (data.customer) {
          setForm((current) => ({
            ...current,
            customerName: current.customerName || data.customer?.customerName || "",
            phone: current.phone || data.customer?.phone || "",
            address: current.address || data.customer?.address || ""
          }));
        }
      } catch {
        // Lookup is optional in phase 1.
      }
    }, 550);

    return () => window.clearTimeout(timeout);
  }, [form.idCard]);

  function update(field: keyof BookingReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateMoney(field: keyof BookingReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: numericOnly(value) }));
  }

  function updateFinance(field: keyof BookingFinanceSigningInput, value: string) {
    setFinance((current) => ({ ...current, [field]: value }));
  }

  function updateFinanceMoney(field: "income" | "downPayment" | "financePrice", value: string) {
    const normalized = value.replace(/,/g, "").trim();
    setFinance((current) => ({
      ...current,
      [field]: /^\d*$/.test(normalized) ? normalized : value,
      ...(field === "financePrice" ? { financePriceSource: "manual" as const } : {})
    }));
  }

  async function persistFinanceMetadata(reportId: string, plate: string) {
    return readJson("/api/booking-reports/finance-signing", {
      method: "POST",
      body: JSON.stringify({ bookingReportId: reportId, plate, ...finance })
    });
  }

  async function saveFinanceMetadataOnly() {
    if (!savedReportId) return;
    setSavingFinance(true);
    setError("");
    setMessage("");
    try {
      await persistFinanceMetadata(savedReportId, form.plate);
      setMessage("บันทึกข้อมูลส่งงานเซ็นไฟแนนซ์แล้ว โดยไม่บันทึกรายงานจองซ้ำ");
    } catch (financeError) {
      setError(financeError instanceof Error ? financeError.message : "บันทึกข้อมูลส่งงานเซ็นไฟแนนซ์ไม่สำเร็จ");
    } finally {
      setSavingFinance(false);
    }
  }

  function updateBuyerType(value: BuyerType) {
    setForm((current) => ({ ...current, buyerType: value }));
  }

  function handleFiles(category: BookingAttachmentCategory, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    setUploadedAttachments([]);
    setDraftUrl("");
    setAttachmentFiles((current) => ({
      ...current,
      [category]: [...current[category], ...files]
    }));
    event.target.value = "";
  }

  function removeFile(category: BookingAttachmentCategory, index: number) {
    setUploadedAttachments([]);
    setDraftUrl("");
    setAttachmentFiles((current) => ({
      ...current,
      [category]: current[category].filter((_, fileIndex) => fileIndex !== index)
    }));
  }

  function buildAttachments(): BookingAttachment[] {
    return attachmentLabels.flatMap(({ key }) =>
      attachmentFiles[key].map((file) => ({
        category: key,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size
      }))
    );
  }

  async function uploadBookingFiles(): Promise<DriveUploadResult> {
    const items = attachmentLabels.flatMap(({ key, label }) =>
      attachmentFiles[key].map((file, index) => ({ category: key, label, file, index }))
    );

    if (!items.length) return { folderUrl: driveFolderUrl, attachments: [] };

    setUploading(true);
    setUploadProgress(`กำลังเตรียมไฟล์ ${items.length} ไฟล์`);
    const files = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setUploadProgress(`กำลังอ่านไฟล์ ${index + 1}/${items.length}: ${item.label}`);
      const compressedFile = await compressBookingImage(item.file);
      files.push({
        clientId: `${item.category}-${item.index}-${compressedFile.name}-${compressedFile.lastModified}`,
        category: item.category,
        label: item.label,
        name: compressedFile.name,
        type: compressedFile.type || "application/octet-stream",
        size: compressedFile.size,
        base64: await fileToBase64(compressedFile)
      });
    }

    setUploadProgress("กำลังอัปโหลดรูปจองเข้า Google Drive");
    const data = await readJson<{ result: DriveUploadResult }>("/api/drive/upload", {
      method: "POST",
      body: JSON.stringify({
        reportType: "booking",
        customerName: form.customerName,
        plate: form.plate,
        saleName: form.saleName,
        files
      })
    });

    setDriveFolderUrl(data.result.folderUrl);
    setUploadProgress("อัปโหลด Google Drive สำเร็จ");
    setUploading(false);
    return data.result;
  }

  function currentCreatePayload(): BookingReportInput {
    return {
      ...form,
      emailSubject: buildDefaultBookingSubject(form),
      year: normalizeCarYear(form.year),
      attachments: buildAttachments(),
      reportText: reportBody,
      salespersonUserId: canSelectOwner ? selectedOwnerUserId || undefined : salesProfile?.id,
      salespersonDisplayName: undefined,
      status: "draft"
    };
  }

  async function createBookingReport(payload: BookingReportInput, requestId: string, confirmationToken = "") {
    let uploadResult: DriveUploadResult = { folderUrl: driveFolderUrl, attachments: [] };
    let uploadWarning = "";
    try {
      uploadResult = await uploadBookingFiles();
    } catch (uploadError) {
      uploadWarning = uploadError instanceof Error ? uploadError.message : "อัปโหลด Google Drive ไม่สำเร็จ";
      setUploadProgress("");
      setUploading(false);
    }

    const savedPayload: BookingReportInput = {
      ...payload,
      attachments: uploadResult.attachments.length
        ? uploadResult.attachments
            .filter((attachment) => isBookingAttachmentCategory(attachment.category))
            .map((attachment) => ({ ...attachment, category: attachment.category as BookingAttachmentCategory }))
        : payload.attachments
    };

    window.localStorage.setItem(
      "bigcar-booking-email",
      JSON.stringify({
        emailTo: savedPayload.emailTo,
        emailCc: savedPayload.emailCc,
        emailBcc: savedPayload.emailBcc
      })
    );

    try {
      const data = await readJson<{
        report: { id: string };
        partialSuccess?: boolean;
        warning?: string;
      }>("/api/booking-reports", {
        method: "POST",
        body: JSON.stringify({ report: savedPayload, requestId, confirmationToken })
      });
      setSavedReportId(data.report.id);
      if (payload.paymentType.includes("ไฟแนนซ์") || payload.paymentType.toLowerCase().includes("finance")) {
        try {
          await persistFinanceMetadata(data.report.id, payload.plate);
        } catch (financeError) {
          uploadWarning = financeError instanceof Error
            ? `บันทึกรายงานจองแล้ว แต่ข้อมูลส่งงานเซ็นไฟแนนซ์ยังเก็บไว้ในเครื่อง: ${financeError.message}`
            : "บันทึกรายงานจองแล้ว แต่ข้อมูลส่งงานเซ็นไฟแนนซ์ยังเก็บไว้ในเครื่อง";
        }
      }
      setDuplicatePrompt(null);
      setPendingCreate(null);
      setConfirmExceptionalCreate(false);
      setUploadedAttachments(uploadResult.attachments);
      if (data.partialSuccess) {
        setError(data.warning || "บันทึก Booking Report แล้ว แต่ Booking Delivery Master ไม่สำเร็จ");
      } else if (uploadWarning) {
        setError(`${uploadWarning} - บันทึก Draft ลง Google Sheets แบบไม่มีไฟล์ Drive แล้ว`);
      } else {
        setMessage(uploadResult.attachments.length ? "อัปโหลดรูปเข้า Google Drive และบันทึก Draft รายงานจองแล้ว" : "บันทึก Draft ลง Google Sheets แล้ว ยังไม่มีการส่ง Email/LINE จริง");
      }
    } catch (err) {
      window.localStorage.setItem("bigcar-booking-draft-fallback", JSON.stringify(savedPayload));
      setError(
        err instanceof Error
          ? `${err.message} - บันทึก draft สำรองในเครื่องนี้แล้ว`
          : "บันทึก Google Sheets ไม่สำเร็จ - บันทึก draft สำรองในเครื่องนี้แล้ว"
      );
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setUploadProgress("");
    setDraftUrl("");
    try {
      const payload = currentCreatePayload();
      const requestId = crypto.randomUUID();
      const response = await fetch("/api/booking-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: payload, requestId, checkOnly: true })
      });
      const data = await response.json();
      if (response.status === 409 && data.status === "duplicate_booking_confirmation_required") {
        setPendingCreate({ report: payload, requestId: data.requestId || requestId });
        setDuplicatePrompt(data as BookingDuplicatePrompt);
        setConfirmExceptionalCreate(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || "ตรวจสอบรายงานจองเดิมไม่สำเร็จ");
      await createBookingReport(payload, requestId);
    } catch (err) {
      const payload = currentCreatePayload();
      window.localStorage.setItem("bigcar-booking-draft-fallback", JSON.stringify(payload));
      setError(err instanceof Error ? `${err.message} - บันทึก draft สำรองในเครื่องนี้แล้ว` : "บันทึกไม่สำเร็จ");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  async function confirmDuplicateCreate() {
    if (!duplicatePrompt || !pendingCreate) return;
    setSaving(true);
    setError("");
    try {
      await createBookingReport(pendingCreate.report, pendingCreate.requestId, duplicatePrompt.confirmationToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างรายงานจองใหม่ไม่สำเร็จ");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  async function createEmailDraft() {
    setDrafting(true);
    setError("");
    setMessage("");
    setDraftUrl("");
    setUploadProgress("");

    try {
      let attachments = uploadedAttachments;
      if (!attachments.length && Object.values(attachmentFiles).some((files) => files.length > 0)) {
        const uploadResult = await uploadBookingFiles();
        attachments = uploadResult.attachments;
        setUploadedAttachments(uploadResult.attachments);
      }

      window.localStorage.setItem(
        "bigcar-booking-email",
        JSON.stringify({
          emailTo: form.emailTo,
          emailCc: form.emailCc,
          emailBcc: form.emailBcc
        })
      );

      const data = await readJson<{ result: { draftUrl: string } }>("/api/email/booking-draft", {
        method: "POST",
        body: JSON.stringify({
          reportId: savedReportId,
          subject: buildDefaultBookingSubject(form),
          to: form.emailTo,
          cc: form.emailCc,
          bcc: form.emailBcc,
          body: gmailBody,
          attachments: attachments
            .filter((attachment) => attachment.fileId)
            .map((attachment) => ({ fileId: attachment.fileId, name: attachment.name }))
        })
      });

      setDraftUrl(data.result.draftUrl);
      setMessage("สร้าง Gmail Draft รายงานจองแล้ว ยังไม่ได้ส่งจริง");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง Gmail Draft รายงานจองไม่สำเร็จ");
    } finally {
      setDrafting(false);
      setUploading(false);
    }
  }

  async function copyReport() {
    setCopying(true);
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(reportBody);
      setMessage("คัดลอก Preview รายงานแล้ว");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความใน Preview แล้ว copy เอง");
    } finally {
      window.setTimeout(() => setCopying(false), 500);
    }
  }

  async function sendLineReport() {
    setSendingLine(true);
    setError("");
    setMessage("");

    try {
      if (!selectedLineGroupId) throw new Error("กรุณาเลือกกลุ่ม LINE ก่อนส่ง");
      if (!lineBody.trim()) throw new Error("ยังไม่มีข้อความรายงานจองสำหรับส่ง LINE");

      await readJson("/api/line/test-send", {
        method: "POST",
        body: JSON.stringify({
          groupId: selectedLineGroupId,
          message: lineBody
        })
      });
      setMessage("ส่งข้อความรายงานจองเข้า LINE แล้ว กำลังจัดการรูปแนบ...");

      let attachments = uploadedAttachments;
      let uploadWarning = "";
      if (!attachments.length && Object.values(attachmentFiles).some((files) => files.length > 0)) {
        try {
          const uploadResult = await uploadBookingFiles();
          attachments = uploadResult.attachments;
          setUploadedAttachments(uploadResult.attachments);
        } catch (uploadError) {
          uploadWarning = uploadError instanceof Error ? uploadError.message : "อัปโหลดรูปไม่สำเร็จ";
          attachments = [];
        }
      }

      try {
        const data = await readJson<{ result: { imageCount: number; linkCount: number } }>("/api/line/send-report", {
          method: "POST",
          body: JSON.stringify({
            groupId: selectedLineGroupId,
            message: "รูปแนบรายงานจอง",
            attachments: attachments.map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              url: attachment.url,
              fileId: attachment.fileId
            }))
          })
        });

        setMessage(`ส่งรายงานจองเข้า LINE แล้ว${data.result.imageCount ? ` พร้อมรูป ${data.result.imageCount} รูป` : ""}${data.result.linkCount ? ` และลิงก์ไฟล์ ${data.result.linkCount} รายการ` : ""}${uploadWarning ? ` (${uploadWarning})` : ""}`);
      } catch (sendError) {
        const warning = sendError instanceof Error ? sendError.message : "ส่งรูปไม่สำเร็จ";
        setMessage(`ส่งข้อความรายงานจองเข้า LINE แล้ว แต่รูปยังไม่สำเร็จ (${uploadWarning || warning})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง LINE ไม่สำเร็จ");
    } finally {
      setUploading(false);
      setSendingLine(false);
    }
  }

  return (
    <NativeAppShell className="max-w-5xl">
      <NativeAppHeader
        title="รายงานจอง"
        subtitle={salesProfile ? `ใช้โปรไฟล์เซลล์: ${salesProfile.nickname}` : "บันทึก Draft, สร้าง Gmail Draft และส่งข้อความเข้า LINE"}
        actions={
          <>
            <NativeBadge>Booking</NativeBadge>
            <TopMenuButton href="/sales-reports" icon={<FileText size={18} />} variant="primary">
              ขาย
            </TopMenuButton>
          </>
        }
      />

      {(message || error || companyWarning) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            error || companyWarning
              ? "border-amber-400/40 bg-amber-950/30 text-amber-100"
              : "border-emerald-400/35 bg-emerald-950/25 text-emerald-100"
          }`}
        >
          {error || companyWarning ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} />}
          <span>{error || (companyWarning ? "ผู้ซื้อเป็นบริษัท: ควรแนบหนังสือรับรองบริษัทก่อนส่งจริง" : message)}</span>
        </div>
      )}

      <section className="mb-4">
        <SectionCard title="OCR Smart Document" icon={<Clipboard size={18} />}>
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs leading-5 text-soft">
              รองรับบัตรประชาชน หนังสือรับรองบริษัท และนามบัตร เปิดสแกนใน modal/drawer แยก ตรวจข้อมูลก่อนเติมเข้ารายงานจองเสมอ และจะไม่บันทึกอัตโนมัติ
            </p>
            <BookingReportOcrScanner
              buyerType={form.buyerType}
              current={form}
              onApply={(next) => {
                setForm(next);
                setMessage("OCR เติมข้อมูลลงฟอร์มแล้ว กรุณาตรวจต่อก่อนบันทึก Draft");
              }}
            />
          </div>
        </SectionCard>
      </section>

      <form onSubmit={saveDraft} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="space-y-4">
          <SectionCard title="ข้อมูลลูกค้า" icon={<ClipboardList size={18} />}>
            <Field label="วันที่จอง" type="date" value={form.bookingDate} onChange={(value) => update("bookingDate", value)} required />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateBuyerType("individual")}
                className={`min-h-11 rounded-lg border px-3 font-semibold ${
                  form.buyerType === "individual" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                บุคคลธรรมดา
              </button>
              <button
                type="button"
                onClick={() => updateBuyerType("company")}
                className={`min-h-11 rounded-lg border px-3 font-semibold ${
                  form.buyerType === "company" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"
                }`}
              >
                บริษัท
              </button>
            </div>
            <Field label="ชื่อผู้ซื้อ" value={form.customerName} onChange={(value) => update("customerName", value)} required />
            <Field label="เลขบัตรประชาชน / เลขผู้เสียภาษี" value={form.idCard} onChange={(value) => update("idCard", value)} inputMode="tel" />
            <Field label="เบอร์โทร" value={form.phone} onChange={(value) => update("phone", value)} inputMode="tel" />
            <TextArea label="ที่อยู่จัดส่งเอกสาร" value={form.address} onChange={(value) => update("address", value)} rows={3} />
          </SectionCard>

          <SectionCard title="ข้อมูลรถ" icon={<Search size={18} />}>
            <Field label="ทะเบียนรถ" value={form.plate} onChange={(value) => update("plate", value)} required />
            {lookupStatus && <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs text-soft">{lookupStatus}</p>}
            {form.plate.trim().length >= 3 && (
              <a
                href={`/stock-export?query=${encodeURIComponent(form.plate.trim())}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 text-xs font-bold text-brand underline-offset-2 hover:underline"
              >
                เปิดค้นหาสต๊อกจากทะเบียน {form.plate.trim()}
              </a>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ยี่ห้อรถยนต์" value={form.brand} onChange={(value) => update("brand", value)} />
              <Field label="รุ่น" value={form.model} onChange={(value) => update("model", value)} />
              <Field label="ปีรถ" value={form.year} onChange={(value) => update("year", normalizeCarYear(value))} inputMode="numeric" />
              <Field label="สี" value={form.color} onChange={(value) => update("color", value)} />
            </div>
          </SectionCard>

          <SectionCard title="ข้อมูลราคา" icon={<FileText size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="จองรถยนต์" value={form.bookingPrice} onChange={(value) => updateMoney("bookingPrice", value)} inputMode="numeric" />
              <Field label="ราคาที่ตั้งขาย" value={form.salePrice} onChange={(value) => updateMoney("salePrice", value)} inputMode="numeric" />
              <Field label="ราคาที่ขาย" value={form.finalPrice} onChange={(value) => updateMoney("finalPrice", value)} inputMode="numeric" />
              <Field label="ส่วนลด" value={form.discount} onChange={(value) => updateMoney("discount", value)} inputMode="numeric" />
            </div>
            <Field label="หมายเหตุราคาที่ขาย" value={form.finalPriceNote} onChange={(value) => update("finalPriceNote", value)} placeholder="เช่น ส่วนลด 4,000" />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update("paymentType", "ซื้อสด")}
                className={`min-h-11 rounded-lg border px-3 text-sm font-black ${paymentMode === "cash" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                ซื้อสด
              </button>
              <button
                type="button"
                onClick={() => update("paymentType", "ไฟแนนซ์")}
                className={`min-h-11 rounded-lg border px-3 text-sm font-black ${paymentMode === "finance" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
              >
                ไฟแนนซ์
              </button>
            </div>
            <Field label="การชำระเงิน" value={form.paymentType} onChange={(value) => update("paymentType", value)} placeholder="เงินสด / ไฟแนนซ์" />
            <PaymentWorkflowHint mode={paymentMode} />
          </SectionCard>

          {paymentMode === "finance" && (
            <SectionCard title="ข้อมูลส่งงานเซ็นไฟแนนซ์" icon={<FileText size={18} />}>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Field label="ไฟแนนซ์" value={finance.financeCompany} onChange={(value) => updateFinance("financeCompany", value)} placeholder="เช่น กสิกร / กรุงศรี / TISCO" />
                <Field label="สถานที่นัดเซ็น" value={finance.signingLocation} onChange={(value) => updateFinance("signingLocation", value)} />
                <Field label="อาชีพ" value={finance.occupation} onChange={(value) => updateFinance("occupation", value)} />
                <Field label="อายุงาน" value={finance.employmentDuration} onChange={(value) => updateFinance("employmentDuration", value)} />
                <Field label="รายได้" value={formatFinanceMoney(finance.income) || finance.income} onChange={(value) => updateFinanceMoney("income", value)} inputMode="numeric" />
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">ลูกค้ามีเครดิตหรือไม่</span>
                  <select
                    value={finance.creditStatus}
                    onChange={(event) => updateFinance("creditStatus", event.target.value)}
                    className="min-h-12 w-full min-w-0 rounded-lg border border-line bg-[#0b0d11] px-3 text-base text-white outline-none focus:border-brand"
                  >
                    <option value="">เลือกสถานะเครดิต</option>
                    <option value="มี">มี</option>
                    <option value="ไม่มี">ไม่มี</option>
                    <option value="ไม่ทราบ">ไม่ทราบ</option>
                  </select>
                </label>
                <div className="min-w-0">
                  <Field
                    label="ราคารถสำหรับจัดไฟแนนซ์"
                    value={formatFinanceMoney(finance.financePrice) || finance.financePrice}
                    onChange={(value) => updateFinanceMoney("financePrice", value)}
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-xs text-soft">
                    แหล่งข้อมูล: {finance.financePriceSource === "stock" ? "จากสต็อก" : finance.financePriceSource === "manual" ? "กรอกเอง" : "ยังไม่ระบุ"}
                  </p>
                </div>
                <Field label="เงินดาวน์" value={formatFinanceMoney(finance.downPayment) || finance.downPayment} onChange={(value) => updateFinanceMoney("downPayment", value)} inputMode="numeric" />
                <Field
                  label="ยอดจัด (ก่อน VAT)"
                  value={financeAmount.amount === null ? "" : formatFinanceMoney(financeAmount.amount)}
                  onChange={() => undefined}
                  readOnly
                  placeholder={financeAmount.error || "ราคารถสำหรับจัดไฟแนนซ์ - เงินดาวน์"}
                />
              </div>
              <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${financeAmount.error ? "border-amber-400/35 bg-amber-950/25 text-amber-100" : "border-line bg-[#0b0d11] text-soft"}`}>
                {financeAmount.error || `ใช้ราคารถสำหรับจัดไฟแนนซ์ ${formatFinanceMoney(finance.financePrice)} บาท เป็นฐานคำนวณ โดยไม่มี VAT หรือดอกเบี้ย`}
              </p>
              {savedReportId && (
                <button
                  type="button"
                  onClick={saveFinanceMetadataOnly}
                  disabled={savingFinance}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand/50 bg-[#0b0d11] px-4 font-bold text-brand disabled:opacity-60 sm:w-auto"
                >
                  {savingFinance ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {savingFinance ? "กำลังบันทึก..." : "บันทึกข้อมูลไฟแนนซ์"}
                </button>
              )}
            </SectionCard>
          )}

          <SectionCard title="การตลาดและ Sale" icon={<Mail size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="แหล่งที่มา" value={form.source} onChange={(value) => update("source", value)} />
              <Field label="กรรมสิทธิ์" value={form.ownership} onChange={(value) => update("ownership", value)} />
              <Field label="Project" value={form.project} onChange={(value) => update("project", value)} />
              <Field label="Campaign" value={form.campaign} onChange={(value) => update("campaign", value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {canSelectOwner ? (
                <UserSelect
                  label="เซลส์เจ้าของเคส"
                  value={selectedOwnerUserId}
                  onChange={setSelectedOwnerUserId}
                  users={eligibleSalesUsers}
                  required
                />
              ) : (
                <Field label="Sale" value={form.saleName} onChange={() => undefined} readOnly />
              )}
              <Field label="ทีม" value={form.teamName} onChange={(value) => update("teamName", value)} placeholder="เช่น พี่ลีฟ" />
            </div>
            {salesProfile && (
              <p className="rounded-lg border border-emerald-400/30 bg-emerald-950/20 px-3 py-2 text-xs leading-5 text-emerald-100">
                ดึงจากโปรไฟล์ Login: {salesProfile.firstName} {salesProfile.lastName} · {salesProfile.phone} · {salesProfile.branch}
              </p>
            )}
            <TextArea label="เงื่อนไข" value={form.conditions} onChange={(value) => update("conditions", value)} rows={5} />
          </SectionCard>

          <SectionCard title="Gmail Draft" icon={<Mail size={18} />}>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs text-soft">
              ผู้ส่ง: Gmail กลางของ BIG CAR CRM · เจ้าของเคสในรายงาน: {selectedOwner ? `${selectedOwner.firstName} ${selectedOwner.lastName}`.trim() : salesProfile ? `${salesProfile.firstName} ${salesProfile.lastName}`.trim() : "ระบบจะตรวจจาก CRM Login"} · สร้างเป็น Draft เท่านั้น
            </p>
            <Field label="หัวข้ออีเมล" value={buildDefaultBookingSubject(form)} onChange={() => undefined} />
            <div className="grid min-w-0 gap-3">
              <Field label="To" type="email" value={form.emailTo} onChange={(value) => update("emailTo", value)} placeholder={defaultEmailTo} />
              <Field label="CC" type="email" value={form.emailCc} onChange={(value) => update("emailCc", value)} placeholder={defaultEmailCc} />
              <Field label="BCC" type="email" value={form.emailBcc} onChange={(value) => update("emailBcc", value)} placeholder="ไม่บังคับ" />
            </div>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs text-soft">ค่าเริ่มต้น To: RDDUsedcarBooked@segroup.co.th · CC: rongsarit.s@tgh.co.th และระบบจะจำค่าที่เลือกไว้ใน browser นี้</p>
            <button
              type="button"
              onClick={createEmailDraft}
              disabled={drafting || uploading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-brand/50 bg-[#0b0d11] px-4 font-bold text-brand disabled:opacity-70"
            >
              {drafting || uploading ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
              {drafting ? "กำลังสร้าง Gmail Draft..." : "สร้าง Gmail Draft"}
            </button>
            {draftUrl && (
              <a href={draftUrl} target="_blank" rel="noreferrer" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink">
                <Mail size={20} />
                เปิด Gmail Draft
              </a>
            )}
          </SectionCard>

          <SectionCard title="ไฟล์แนบ Draft" icon={<Paperclip size={18} />}>
            {(uploadProgress || driveFolderUrl) && (
              <div className="rounded-lg border border-emerald-400/35 bg-emerald-950/20 p-3 text-sm text-emerald-100">
                <div className="flex items-start gap-2">
                  {uploading ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-brand" /> : <Cloud size={18} className="mt-0.5 shrink-0 text-brand" />}
                  <div className="min-w-0">
                    <p className="font-semibold">{uploadProgress || "Google Drive พร้อมใช้งาน"}</p>
                    {driveFolderUrl && (
                      <a href={driveFolderUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-brand underline">
                        เปิดโฟลเดอร์ Google Drive
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DraftAttachmentBox
              title="ไฟล์แนบ Draft"
              categoryLabel="เลือกประเภทไฟล์"
              attachmentLabels={attachmentLabels}
              selectedCategory={selectedAttachmentCategory}
              onSelectCategory={setSelectedAttachmentCategory}
              filesByCategory={attachmentFiles}
              onChange={handleFiles}
              onRemove={removeFile}
            />
          </SectionCard>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SectionCard>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Preview รายงาน</h2>
                <p className="text-xs text-soft">ข้อความคงรูปแบบตาม template</p>
              </div>
              <button
                type="button"
                onClick={copyReport}
                disabled={copying}
                className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand transition hover:border-brand"
              >
                {copying ? <Loader2 size={17} className="animate-spin" /> : <Clipboard size={17} />}
                Copy
              </button>
            </div>
            <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-7 text-white">
              {reportBody}
            </pre>
            {paymentMode === "finance" && (
              <div className="mt-4 min-w-0">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-white">Preview ส่งงานเซ็นไฟแนนซ์</h2>
                  <p className="text-xs text-soft">ข้อมูลส่วนนี้เพิ่มเติมจากรายงานการจอง และยังบันทึก Booking ได้แม้กรอกไม่ครบ</p>
                </div>
                <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap rounded-lg border border-brand/30 bg-[#0b0d11] p-3 text-sm leading-7 text-white">
                  {financePreview}
                </pre>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">ส่งเข้า LINE กลุ่ม</span>
                <select
                  value={selectedLineGroupId}
                  onChange={(event) => setSelectedLineGroupId(event.target.value)}
                  className="min-h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
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
              </label>
              <NativeButton
                type="button"
                onClick={sendLineReport}
                disabled={sendingLine || !selectedLineGroupId || !lineBody.trim()}
                className="w-full"
              >
                {sendingLine ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                {sendingLine ? "กำลังส่ง LINE..." : "ส่ง LINE"}
              </NativeButton>
            </div>
            <NativeButton
              type="submit"
              disabled={saving || uploading}
              className="mt-3 w-full"
            >
              {saving || uploading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {uploading ? "กำลังอัปโหลดรูป..." : "บันทึก Draft"}
            </NativeButton>
            {driveFolderUrl && (
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-brand/50 bg-[#0b0d11] px-4 py-3 text-base font-bold text-brand"
              >
                <Cloud size={20} />
                เปิดโฟลเดอร์ Google Drive
              </a>
            )}
            <p className="mt-3 text-xs leading-5 text-soft">
              ปุ่ม LINE จะอัปโหลดไฟล์แนบเข้า Google Drive ก่อน แล้วส่งข้อความพร้อมรูปที่ LINE รองรับเข้ากลุ่มที่เลือก
            </p>
          </SectionCard>
        </aside>
      </form>

      {duplicatePrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="duplicate-booking-title">
          <section className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl border border-brand/40 bg-[#141821] p-4 shadow-2xl">
            <h2 id="duplicate-booking-title" className="text-lg font-bold text-white">{confirmExceptionalCreate ? "ยืนยันสร้างรายงานจองใหม่?" : "พบรายงานจองเดิม"}</h2>
            {confirmExceptionalCreate ? (
              <>
                <p className="mt-3 text-sm leading-6 text-amber-50">รายงานเดิมจะไม่ถูกแก้ไข และระบบจะสร้างเคสใหม่แยกต่างหาก</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setConfirmExceptionalCreate(false)} disabled={saving} className="min-h-11 rounded-lg border border-line px-3 font-semibold text-white">กลับ</button>
                  <button type="button" onClick={confirmDuplicateCreate} disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 font-bold text-ink disabled:opacity-60">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : null}{saving ? "กำลังบันทึก..." : "ยืนยันสร้างเคสใหม่"}
                  </button>
                </div>
              </>
            ) : (
              <>
            <div className="mt-3 rounded-lg border border-line bg-[#0b0d11] p-3 text-sm">
              <p className="font-semibold text-white">ลูกค้า: {pendingCreate?.report.customerName || form.customerName}</p>
              <p className="mt-1 text-soft">ทะเบียน: {pendingCreate?.report.plate || form.plate}</p>
              <p className="mt-1 text-soft">พบรายการเดิม {duplicatePrompt.matches.length} รายการ</p>
            </div>
            <div className="mt-3 space-y-2">
              {duplicatePrompt.matches.map((match) => (
                <div key={match.bookingReportId} className="rounded-lg border border-line p-3 text-sm">
                  <p className="font-semibold text-white">{formatThaiReportDate(match.bookingDate)} · {match.customerName}</p>
                  <p className="mt-1 text-xs text-soft">เซลส์: {match.salespersonDisplayName || "-"} · สถานะ: {match.status || "-"}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-50">ลูกค้าและทะเบียนนี้มีรายงานจองอยู่แล้ว คุณสามารถเปิดรายงานเดิมเพื่อทำงานต่อได้</p>
            <div className="mt-4 grid gap-2">
              <a href={`/report-history?q=${encodeURIComponent(duplicatePrompt.matches[0]?.bookingReportId || "")}`} className="flex min-h-12 items-center justify-center rounded-lg bg-brand px-3 text-sm font-bold text-ink">เปิดรายงานเดิม</a>
              <button type="button" onClick={() => { setDuplicatePrompt(null); setPendingCreate(null); setConfirmExceptionalCreate(false); }} disabled={saving} className="min-h-11 rounded-lg border border-line px-3 font-semibold text-white">ยกเลิก</button>
              <button type="button" onClick={() => setConfirmExceptionalCreate(true)} disabled={saving} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-soft underline decoration-white/20 underline-offset-4 hover:text-white">สร้างเป็นเคสใหม่</button>
            </div>
              </>
            )}
          </section>
        </div>
      )}
    </NativeAppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  inputMode,
  readOnly,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "numeric";
  readOnly?: boolean;
  type?: "text" | "date" | "email";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        readOnly={readOnly}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function UserSelect({
  label,
  value,
  onChange,
  users,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  users: SalesUser[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-base text-white outline-none focus:border-brand"
      >
        <option value="">เลือกเซลส์</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {[user.nickname || user.firstName, user.branch].filter(Boolean).join(" · ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="min-h-24 w-full resize-y rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function PaymentWorkflowHint({ mode }: { mode: "cash" | "finance" | "unset" }) {
  if (mode === "cash") {
    return (
      <div className="rounded-lg border border-brand/35 bg-brand/10 px-3 py-3 text-sm leading-6 text-brand">
        ซื้อสด: หลังมีรายงานจองแล้ว รถคันนี้เข้า “รอส่งมอบ” ได้ทันที
      </div>
    );
  }

  if (mode === "finance") {
    return (
      <div className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-3 text-sm leading-6 text-amber-100">
        ไฟแนนซ์: เคสนี้อยู่ “รอผลไฟแนนซ์” ก่อน จนกว่าจะอัปโหลดใบอนุมัติ
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-sm leading-6 text-soft">
      เลือกซื้อสดหรือไฟแนนซ์เพื่อให้ทีมเห็น workflow ถัดไปชัดเจนขึ้น
    </div>
  );
}

function DraftAttachmentBox({
  title,
  categoryLabel,
  attachmentLabels,
  selectedCategory,
  onSelectCategory,
  filesByCategory,
  onChange,
  onRemove
}: {
  title: string;
  categoryLabel: string;
  attachmentLabels: Array<{ key: BookingAttachmentCategory; label: string; hint: string }>;
  selectedCategory: BookingAttachmentCategory;
  onSelectCategory: (value: BookingAttachmentCategory) => void;
  filesByCategory: Record<BookingAttachmentCategory, File[]>;
  onChange: (category: BookingAttachmentCategory, event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (category: BookingAttachmentCategory, index: number) => void;
}) {
  const canUseCamera = true;
  const currentFiles = filesByCategory[selectedCategory] || [];
  const allFiles = attachmentLabels.flatMap((item) =>
    (filesByCategory[item.key] || []).map((file, index) => ({
      category: item.key,
      categoryLabel: item.label,
      file,
      index
    }))
  );

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-soft">{allFiles.length ? `${allFiles.length} ไฟล์` : "ยังไม่ได้เพิ่มไฟล์"}</p>
        </div>
        <Paperclip size={18} className="shrink-0 text-brand" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-soft">{categoryLabel}</span>
          <select
            value={selectedCategory}
            onChange={(event) => onSelectCategory(event.target.value as BookingAttachmentCategory)}
            className="h-12 w-full rounded-lg border border-line bg-[#141821] px-3 text-white outline-none focus:border-brand"
          >
            {attachmentLabels.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand">
          เพิ่มรูป
          <input type="file" multiple accept="image/*,.pdf" onChange={(event) => onChange(selectedCategory, event)} className="sr-only" />
        </label>
        {canUseCamera && (
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-white">
            <Camera size={17} />
            ถ่าย
            <input type="file" multiple accept="image/*" capture="environment" onChange={(event) => onChange(selectedCategory, event)} className="sr-only" />
          </label>
        )}
      </div>

      {currentFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {currentFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#141821] px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-[#dce2eb]">{file.name}</span>
              <button type="button" onClick={() => onRemove(selectedCategory, index)} className="shrink-0 text-amber-200">
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      {allFiles.length > currentFiles.length && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="text-xs font-semibold text-soft">สรุปไฟล์ในแต่ละหมวด</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {attachmentLabels.map((item) => {
              const count = (filesByCategory[item.key] || []).length;
              return (
                <div key={item.key} className="rounded-lg border border-line bg-[#141821] px-3 py-2 text-sm">
                  <p className="truncate text-[#dce2eb]">{item.label}</p>
                  <p className="text-[11px] text-soft">{count} ไฟล์</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
