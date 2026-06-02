"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, Clipboard, Cloud, Eye, FileText, ImagePlus, Loader2, Mail, Save, Search, Send, X } from "lucide-react";
import { NativeAppHeader, NativeAppShell, NativeBadge, TopMenuButton } from "@/app/components/ui";
import { buildSalesPaymentDetail, renderSalesReport } from "@/lib/sales-report";
import { defaultSystemSettings, readSystemSettings, salesLineGroupStorageKey } from "@/lib/client-settings";
import { normalizeCarYear } from "@/lib/format";
import { useSalesProfile } from "@/lib/use-sales-profile";
import { appendSalesProfileSignature } from "@/lib/sales-profile-signature";
import type { BookingAttachment, BookingReport, DriveAttachment, DriveUploadResult, LineGroup, SalesReportInput } from "@/lib/types";

type SalesAttachmentCategory =
  | "vehiclePhotos"
  | "paymentSlips"
  | "salesDocuments";

type LocalAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  originalSize: number;
  url: string;
  file: File;
  driveUrl?: string;
  fileId?: string;
  uploadedAt?: string;
};

const salesAttachmentLabels: Record<SalesAttachmentCategory, string> = {
  vehiclePhotos: "รูปรถ 4 มุม",
  paymentSlips: "เงินจอง / สลิปตัดยอด",
  salesDocuments: "เอกสารขาย"
};

const bookingAttachmentLabels: Record<BookingAttachment["category"], string> = {
  bookingSlip: "รูปใบจอง",
  bookingCondition: "รูปเงื่อนไขการจอง",
  carPhoto: "รูปรถจากรายงานจอง",
  idCard: "รูปบัตรประชาชน",
  companyCertificate: "รูปหนังสือรับรองบริษัท"
};

const vehiclePhotoCategories = new Set<SalesAttachmentCategory>([
  "vehiclePhotos"
]);

const saleEmails: Record<string, string> = {
  "ฐากร": "thakornakin@gmail.com",
  "กันตา": "kanta.deepal@gmail.com"
};
const defaultEmailTo = "RDDUsedcarBooked@segroup.co.th";
const defaultEmailCc = "rongsarit.s@tgh.co.th";
const defaultTeamName = "พี่ลีฟ";

const blankForm: SalesReportInput = {
  bookingReportId: "",
  customerName: "",
  phone: "",
  idCard: "",
  address: "",
  bookingPrice: "",
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  engineNo: "",
  chassisNo: "",
  salePrice: "",
  centralDiscount: "",
  finalPrice: "",
  paymentType: "",
  source: "",
  ownership: "",
  project: "",
  carPrice: "",
  bookingDeduction: "",
  transferFee: "",
  netPayment: "",
  downPayment: "",
  insuranceFee: "",
  paymentDetail: "",
  saleConditions: "",
  saleName: "ฐากร",
  teamName: defaultTeamName,
  branch: "",
  deliveryDate: "",
  reportText: "",
  status: "draft"
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function numericOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function getCompressionProfile(category: SalesAttachmentCategory) {
  return vehiclePhotoCategories.has(category)
    ? { maxWidth: 1600, quality: 0.8 }
    : { maxWidth: 2000, quality: 0.86 };
}

async function compressImageFile(file: File, category: SalesAttachmentCategory): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const image = new Image();
  const sourceUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
      image.src = sourceUrl;
    });

    const { maxWidth, quality } = getCompressionProfile(category);
    const scale = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const safeName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${safeName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function fromBooking(report: BookingReport): SalesReportInput {
  return {
    ...blankForm,
    bookingReportId: report.id,
    customerName: report.customerName,
    phone: report.phone,
    idCard: report.idCard,
    address: report.address,
    bookingPrice: report.bookingPrice,
    plate: report.plate,
    brand: report.brand,
    model: report.model,
    year: normalizeCarYear(report.year),
    color: report.color,
    engineNo: "",
    chassisNo: "",
    salePrice: report.salePrice,
    finalPrice: report.finalPrice,
    carPrice: report.finalPrice,
    bookingDeduction: report.bookingPrice,
    paymentType: report.paymentType,
    source: report.source,
    ownership: report.ownership,
    project: report.project,
    saleConditions: report.conditions,
    saleName: report.saleName,
    teamName: report.teamName || defaultTeamName
  };
}

function defaultSalesEmailSubject(input: SalesReportInput) {
  return ["รายงานขาย", input.customerName, input.model, input.plate].filter(Boolean).join(" - ");
}

function vehicleValue(vehicle: Record<string, any>, keys: string[]) {
  const extra = vehicle?.extraFields && typeof vehicle.extraFields === "object" ? vehicle.extraFields : {};
  for (const key of keys) {
    const value = vehicle?.[key] ?? extra?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

const engineNoKeys = [
  "engineNo",
  "engineNumber",
  "engine",
  "เลขเครื่อง",
  "เลขเครื่องยนต์",
  "Engine",
  "EngineNo",
  "Engine No",
  "Engine No.",
  "EngineNumber",
  "Engine Number",
  "ENGINE_NO",
  "Motor No",
  "MotorNo",
  "motorNo"
];

const chassisNoKeys = [
  "vin",
  "chassisNo",
  "chassisNumber",
  "เลขตัวถัง",
  "เลขตัวรถ",
  "VIN",
  "Chassis"
];

export default function SalesReportsPage() {
  const { user: salesProfile } = useSalesProfile();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookingReport[]>([]);
  const [form, setForm] = useState<SalesReportInput>(blankForm);
  const [selectedBooking, setSelectedBooking] = useState<BookingReport | null>(null);
  const [salesFiles, setSalesFiles] = useState<Partial<Record<SalesAttachmentCategory, LocalAttachment[]>>>({});
  const salesFilesRef = useRef(salesFiles);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [savedReportId, setSavedReportId] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [emailFields, setEmailFields] = useState({
    subject: "",
    to: defaultEmailTo,
    cc: defaultEmailCc,
    bcc: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [selectedLineGroupId, setSelectedLineGroupId] = useState("");
  const [sendingLine, setSendingLine] = useState(false);

  const reportText = useMemo(
    () => appendSalesProfileSignature(renderSalesReport({ ...form, reportText: "" }), salesProfile),
    [form, salesProfile]
  );
  const suggestedEmailSubject = useMemo(
    () => ["รายงานขาย", form.customerName, form.model, form.plate].filter(Boolean).join(" - "),
    [form.customerName, form.model, form.plate]
  );
  const paymentMode = form.paymentType.includes("สด")
    ? "cash"
    : form.paymentType.includes("ไฟแนนซ์") || form.paymentType.toLowerCase().includes("finance")
      ? "finance"
      : "other";

  useEffect(() => {
    salesFilesRef.current = salesFiles;
  }, [salesFiles]);

  useEffect(() => {
    return () => {
      Object.values(salesFilesRef.current).flat().forEach((file) => {
        if (file) URL.revokeObjectURL(file.url);
      });
    };
  }, []);

  useEffect(() => {
    const settings = readSystemSettings();
    setForm((current) => ({
      ...current,
      teamName: current.teamName || settings.defaultTeamName || defaultSystemSettings.defaultTeamName
    }));
    setEmailFields((current) => ({
      ...current,
      to: settings.salesEmailTo || defaultEmailTo,
      cc: settings.salesEmailCc || defaultEmailCc
    }));
    const latest = window.localStorage.getItem("bigcar-sales-email");
    if (latest) {
      try {
        const parsed = JSON.parse(latest) as typeof emailFields;
        setEmailFields((current) => ({
          ...current,
          ...parsed,
          to: settings.salesEmailTo || defaultEmailTo,
          cc: parsed.cc?.trim() || settings.salesEmailCc || defaultEmailCc
        }));
      } catch {
        window.localStorage.removeItem("bigcar-sales-email");
      }
    }
  }, []);

  useEffect(() => {
    api<{ groups: LineGroup[] }>("/api/line/groups")
      .then((data) => {
        setLineGroups(data.groups);
        const savedGroupId = window.localStorage.getItem(salesLineGroupStorageKey) || "";
        const groupId = data.groups.some((group) => group.groupId === savedGroupId)
          ? savedGroupId
          : data.groups[0]?.groupId || "";
        setSelectedLineGroupId(groupId);
      })
      .catch(() => setLineGroups([]));
  }, []);

  useEffect(() => {
    if (selectedLineGroupId) {
      window.localStorage.setItem(salesLineGroupStorageKey, selectedLineGroupId);
    }
  }, [selectedLineGroupId]);

  useEffect(() => {
    setEmailFields((current) => current.subject.trim() ? current : { ...current, subject: suggestedEmailSubject });
  }, [suggestedEmailSubject]);

  useEffect(() => {
    if (!salesProfile) return;
    setForm((current) => ({
      ...current,
      saleName: !current.saleName || current.saleName === blankForm.saleName ? salesProfile.firstName || current.saleName : current.saleName,
      teamName: current.teamName || defaultTeamName,
      branch: current.branch || salesProfile.branch
    }));
  }, [salesProfile]);

  useEffect(() => {
    const plate = String(form.plate || "").trim();
    if (!plate) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(`/api/stock/lookup?plate=${encodeURIComponent(plate)}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        if (!result.ok) return;
        const data = await result.json();
        let vehicle = data?.vehicle || null;
        if (vehicle && !vehicleValue(vehicle, engineNoKeys)) {
          const listResult = await fetch(`/api/stock/list?query=${encodeURIComponent(plate)}&limit=10`, {
            signal: controller.signal,
            cache: "no-store"
          });
          if (listResult.ok) {
            const listData = await listResult.json();
            const normalizedPlate = plate.replace(/\s+/g, "").toUpperCase();
            const fromList = (listData?.vehicles || []).find((item: Record<string, any>) =>
              String(item?.plate || "").replace(/\s+/g, "").toUpperCase() === normalizedPlate
            );
            if (fromList) vehicle = { ...fromList, ...vehicle, engineNo: vehicleValue(vehicle, engineNoKeys) || vehicleValue(fromList, engineNoKeys) };
          }
        }
        if (!vehicle) return;
        setForm((current) => {
          if (String(current.plate || "").trim() !== plate) return current;
          return {
            ...current,
            brand: current.brand || vehicle.brand || "",
            model: current.model || vehicle.model || "",
            year: current.year || vehicle.year || "",
            color: current.color || vehicle.color || "",
            engineNo: current.engineNo || vehicleValue(vehicle, engineNoKeys),
            chassisNo: current.chassisNo || vehicleValue(vehicle, chassisNoKeys)
          };
        });
      } catch {
        // ignore lookup error to avoid disturbing existing flow
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [form.plate]);

  function update(field: keyof SalesReportInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEmail(field: keyof typeof emailFields, value: string) {
    setEmailFields((current) => ({ ...current, [field]: value }));
  }

  function selectBooking(report: BookingReport) {
    setSelectedBooking(report);
    const nextForm = fromBooking(report);
    setForm({
      ...nextForm,
      saleName: nextForm.saleName || salesProfile?.firstName || blankForm.saleName,
      teamName: nextForm.teamName || defaultTeamName,
      branch: nextForm.branch || salesProfile?.branch || ""
    });
  }

  async function addSalesFiles(category: SalesAttachmentCategory, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const nextFiles = await Promise.all(files.map(async (file) => {
      const compressedFile = await compressImageFile(file, category);
      return {
        id: `${category}-${compressedFile.name}-${compressedFile.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: compressedFile.name,
        type: compressedFile.type,
        size: compressedFile.size,
        originalSize: file.size,
        url: URL.createObjectURL(compressedFile),
        file: compressedFile
      };
    }));

    setSalesFiles((current) => ({
      ...current,
      [category]: [...(current[category] || []), ...nextFiles]
    }));
  }

  function removeSalesFile(category: SalesAttachmentCategory, id: string) {
    setSalesFiles((current) => {
      const remaining = (current[category] || []).filter((file) => {
        if (file.id === id) URL.revokeObjectURL(file.url);
        return file.id !== id;
      });
      return { ...current, [category]: remaining };
    });
  }

  function getAllSalesFiles() {
    return Object.entries(salesFiles).flatMap(([category, files]) =>
      (files || []).map((file) => ({ ...file, category: category as SalesAttachmentCategory }))
    );
  }

  async function uploadPendingFiles() {
    const allFiles = getAllSalesFiles();
    const existingAttachments: DriveAttachment[] = allFiles
      .filter((file) => file.driveUrl && file.fileId)
      .map((file) => ({
        clientId: file.id,
        category: file.category,
        label: salesAttachmentLabels[file.category],
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.driveUrl || "",
        fileId: file.fileId || "",
        folderUrl: driveFolderUrl,
        uploadedAt: file.uploadedAt || ""
      }));
    const pendingFiles = allFiles.filter((file) => !file.driveUrl);
    if (!pendingFiles.length) {
      return {
        folderUrl: driveFolderUrl,
        attachments: existingAttachments
      };
    }

    setUploading(true);
    setUploadProgress(`กำลังเตรียมไฟล์ ${pendingFiles.length} ไฟล์`);
    const payloadFiles = [];

    for (let index = 0; index < pendingFiles.length; index += 1) {
      const file = pendingFiles[index];
      setUploadProgress(`กำลังอ่านไฟล์ ${index + 1}/${pendingFiles.length}: ${salesAttachmentLabels[file.category]}`);
      payloadFiles.push({
        clientId: file.id,
        category: file.category,
        label: salesAttachmentLabels[file.category],
        name: file.name,
        type: file.type,
        size: file.size,
        base64: await fileToBase64(file.file)
      });
    }

    setUploadProgress("กำลังอัปโหลดเข้า Google Drive");
    const data = await api<{ result: DriveUploadResult }>("/api/drive/upload", {
      method: "POST",
      body: JSON.stringify({
        reportType: "sales",
        customerName: form.customerName,
        plate: form.plate,
        saleName: form.saleName,
        files: payloadFiles
      })
    });

    const uploadedById = new Map(data.result.attachments.map((attachment) => [attachment.clientId, attachment]));
    setSalesFiles((current) => {
      const next: Partial<Record<SalesAttachmentCategory, LocalAttachment[]>> = {};
      (Object.entries(current) as [SalesAttachmentCategory, LocalAttachment[]][]).forEach(([category, files]) => {
        next[category] = files.map((file) => {
          const uploaded = uploadedById.get(file.id);
          return uploaded ? { ...file, driveUrl: uploaded.url, fileId: uploaded.fileId, uploadedAt: uploaded.uploadedAt } : file;
        });
      });
      return next;
    });
    setDriveFolderUrl(data.result.folderUrl);
    setUploadProgress("อัปโหลด Google Drive สำเร็จ");
    setUploading(false);

    return { folderUrl: data.result.folderUrl, attachments: [...existingAttachments, ...data.result.attachments] };
  }

  async function searchReports(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ reports: BookingReport[] }>(`/api/booking-reports/search?q=${encodeURIComponent(query)}`);
      setResults(data.reports);
      if (!data.reports.length) setMessage("ไม่พบรายงานจองที่ตรงกับคำค้น");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setUploadProgress("");
    try {
      let uploadResult: DriveUploadResult = { folderUrl: driveFolderUrl, attachments: [] };
      let uploadWarning = "";
      try {
        uploadResult = await uploadPendingFiles();
      } catch (uploadError) {
        uploadWarning = uploadError instanceof Error ? uploadError.message : "อัปโหลด Google Drive ไม่สำเร็จ";
        setUploadProgress("");
      }
      const data = await api<{ report: { id: string } }>("/api/sales-reports", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          emailSubject: emailFields.subject,
          emailTo: emailFields.to,
          emailCc: emailFields.cc,
          emailBcc: emailFields.bcc,
          attachments: uploadResult.attachments,
          driveFolderUrl: uploadResult.folderUrl,
          paymentDetail: buildSalesPaymentDetail(form),
          reportText
        })
      });
      setSavedReportId(data.report.id);
      if (uploadWarning) {
        setError(`${uploadWarning} - บันทึก Draft รายงานขายลง Google Sheets แบบไม่มีไฟล์แนบ Drive แล้ว`);
      } else {
        setMessage(uploadResult.attachments.length ? "อัปโหลดรูปเข้า Google Drive และบันทึก Draft รายงานขายแล้ว" : "บันทึก Draft รายงานขายลง Google Sheets แล้ว");
      }
    } catch (err) {
      window.localStorage.setItem("bigcar-sales-draft-fallback", JSON.stringify({ ...form, paymentDetail: buildSalesPaymentDetail(form), reportText }));
      setError(err instanceof Error ? `${err.message} - บันทึกสำรองในเครื่องแล้ว` : "บันทึกไม่สำเร็จ");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setMessage("คัดลอกรายงานขายแล้ว");
      setError("");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้ว copy เอง");
    }
  }

  async function createEmailDraft() {
    setDrafting(true);
    setError("");
    setMessage("");
    setDraftUrl("");
    try {
      if (!emailFields.to.trim()) throw new Error("กรุณากรอก To ก่อนสร้าง Gmail Draft");

      let uploadResult: DriveUploadResult = { folderUrl: driveFolderUrl, attachments: [] };
      try {
        uploadResult = await uploadPendingFiles();
      } catch {
        uploadResult = { folderUrl: driveFolderUrl, attachments: [] };
      }

      const bookingAttachments = (selectedBooking?.attachments || [])
        .filter((attachment) => attachment.fileId)
        .map((attachment) => ({ fileId: attachment.fileId || "", name: attachment.name }));
      const salesAttachments = uploadResult.attachments
        .filter((attachment) => attachment.fileId)
        .map((attachment) => ({ fileId: attachment.fileId, name: attachment.name }));

      window.localStorage.setItem("bigcar-sales-email", JSON.stringify({
        subject: emailFields.subject,
        to: emailFields.to,
        cc: emailFields.cc,
        bcc: emailFields.bcc
      }));

      const data = await api<{ result: { draftUrl: string } }>("/api/email/sales-draft", {
        method: "POST",
        body: JSON.stringify({
          reportId: savedReportId,
          subject: emailFields.subject || defaultSalesEmailSubject(form),
          to: emailFields.to,
          cc: emailFields.cc,
          bcc: emailFields.bcc,
          body: reportText,
          attachments: [...bookingAttachments, ...salesAttachments]
        })
      });

      setDraftUrl(data.result.draftUrl);
      setMessage("สร้าง Gmail Draft แล้ว ยังไม่ได้ส่งจริง");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง Gmail Draft ไม่สำเร็จ");
    } finally {
      setDrafting(false);
      setUploading(false);
    }
  }

  async function sendLineReport() {
    setSendingLine(true);
    setError("");
    setMessage("");

    try {
      if (!selectedLineGroupId) throw new Error("กรุณาเลือกกลุ่ม LINE ก่อนส่ง");
      if (!reportText.trim()) throw new Error("ยังไม่มีข้อความรายงานขายสำหรับส่ง LINE");

      await api("/api/line/test-send", {
        method: "POST",
        body: JSON.stringify({
          groupId: selectedLineGroupId,
          message: reportText
        })
      });
      setMessage("ส่งข้อความรายงานขายเข้า LINE แล้ว กำลังจัดการรูปแนบ...");

      let uploadResult: DriveUploadResult = { folderUrl: driveFolderUrl, attachments: [] };
      try {
        uploadResult = await uploadPendingFiles();
      } catch {
        uploadResult = { folderUrl: driveFolderUrl, attachments: [] };
      }

      const bookingAttachments = (selectedBooking?.attachments || [])
        .filter((attachment) => attachment.fileId)
        .map((attachment) => ({
          name: attachment.name,
          type: attachment.type,
          url: attachment.url,
          fileId: attachment.fileId
        }));
      const salesAttachments = uploadResult.attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        url: attachment.url,
        fileId: attachment.fileId
      }));

      try {
        const data = await api<{ result: { imageCount: number; linkCount: number } }>("/api/line/send-report", {
          method: "POST",
          body: JSON.stringify({
            groupId: selectedLineGroupId,
            message: "รูปแนบรายงานขาย",
            attachments: [...bookingAttachments, ...salesAttachments]
          })
        });

        setMessage(`ส่งรายงานขายเข้า LINE แล้ว${data.result.imageCount ? ` พร้อมรูป ${data.result.imageCount} รูป` : ""}${data.result.linkCount ? ` และลิงก์ไฟล์ ${data.result.linkCount} รายการ` : ""}`);
      } catch (sendError) {
        const warning = sendError instanceof Error ? sendError.message : "ส่งรูปไม่สำเร็จ";
        setMessage(`ส่งข้อความรายงานขายเข้า LINE แล้ว แต่รูปยังไม่สำเร็จ (${warning})`);
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
        title="รายงานขาย"
        subtitle={salesProfile ? `ใช้โปรไฟล์เซลล์: ${salesProfile.nickname}` : "ค้นรายงานจองเดิม แล้วสร้างรายงานขายแบบ Draft / Preview"}
        actions={
          <>
            <NativeBadge>Sales</NativeBadge>
            <TopMenuButton href="/booking-reports" icon={<ArrowLeft size={18} />}>
              รายงานจอง
            </TopMenuButton>
            <TopMenuButton href="/case-closure" icon={<CheckCircle2 size={18} />} variant="primary">
              ปิดเคส
            </TopMenuButton>
          </>
        }
      />

      {(message || error) && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-amber-400/40 bg-amber-950/30 text-amber-100" : "border-brand/40 bg-green-950/30 text-green-100"}`}>
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{error || message}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <form onSubmit={searchReports} className="space-y-3">
              <Field label="ค้นรายงานจอง" value={query} onChange={setQuery} placeholder="ทะเบียน / ชื่อลูกค้า / เบอร์โทร" />
              <button type="submit" disabled={searching} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink">
                {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                ค้นหา
              </button>
            </form>
            {results.length > 0 && (
              <div className="mt-3 space-y-2">
                {results.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => selectBooking(report)}
                    className="w-full rounded-lg border border-line bg-[#0b0d11] p-3 text-left hover:border-brand/60"
                  >
                    <p className="font-bold text-white">{report.customerName || "-"}</p>
                    <p className="mt-1 text-sm text-soft">{report.plate} / {report.model} / {report.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={saveDraft} className="space-y-4">
            <Panel title="ข้อมูลลูกค้าและรถ">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ชื่อลูกค้า" value={form.customerName} onChange={(value) => update("customerName", value)} required />
                <Field label="โทร" value={form.phone} onChange={(value) => update("phone", value)} />
                <Field label="เลขบัตรประชาชน" value={form.idCard} onChange={(value) => update("idCard", value)} />
                <Field label="ทะเบียนรถ" value={form.plate} onChange={(value) => update("plate", value)} required />
                <Field label="ยี่ห้อรถยนต์" value={form.brand} onChange={(value) => update("brand", value)} />
                <Field label="รุ่น" value={form.model} onChange={(value) => update("model", value)} />
                <Field label="ปีรถ" value={form.year} onChange={(value) => update("year", value)} />
                <Field label="สี" value={form.color} onChange={(value) => update("color", value)} />
                <Field label="เลขเครื่อง" value={form.engineNo} onChange={(value) => update("engineNo", value)} />
                <Field label="เลขตัวถัง" value={form.chassisNo} onChange={(value) => update("chassisNo", value)} />
              </div>
              <TextArea label="ที่อยู่จัดส่งเอกสาร" value={form.address} onChange={(value) => update("address", value)} rows={3} />
            </Panel>

            <Panel title="ข้อมูลขาย">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="จองรถยนต์" value={form.bookingPrice} onChange={(value) => update("bookingPrice", numericOnly(value))} />
                <Field label="ราคาที่ตั้งขาย" value={form.salePrice} onChange={(value) => update("salePrice", numericOnly(value))} />
                <Field label="ส่วนลดส่วนกลาง" value={form.centralDiscount} onChange={(value) => update("centralDiscount", numericOnly(value))} />
                <Field label="ราคาที่ขาย" value={form.finalPrice} onChange={(value) => update("finalPrice", numericOnly(value))} required />
                <Field label="การชำระเงิน" value={form.paymentType} onChange={(value) => update("paymentType", value)} />
                <Field label="วันรับรถ" value={form.deliveryDate} onChange={(value) => update("deliveryDate", value)} placeholder="เช่น 18/05/2026" />
                <Field label="แหล่งที่มา" value={form.source} onChange={(value) => update("source", value)} />
                <Field label="กรรมสิทธิ์" value={form.ownership} onChange={(value) => update("ownership", value)} />
                <Field label="Project" value={form.project} onChange={(value) => update("project", value)} />
                <Field label="สาขา" value={form.branch} onChange={(value) => update("branch", value)} />
                <Field label="Sale" value={form.saleName} onChange={(value) => update("saleName", value)} required />
                <Field label="ทีม" value={form.teamName} onChange={(value) => update("teamName", value)} />
              </div>
              {salesProfile && (
                <p className="rounded-lg border border-brand/30 bg-green-950/20 px-3 py-2 text-xs leading-5 text-green-100">
                  ดึงจากโปรไฟล์ Login: {salesProfile.firstName} {salesProfile.lastName} · {salesProfile.phone} · {salesProfile.branch}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update("paymentType", "ซื้อสด")}
                  className={`min-h-11 rounded-lg border px-3 font-semibold ${paymentMode === "cash" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
                >
                  ซื้อสด
                </button>
                <button
                  type="button"
                  onClick={() => update("paymentType", "ไฟแนนซ์")}
                  className={`min-h-11 rounded-lg border px-3 font-semibold ${paymentMode === "finance" ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-white"}`}
                >
                  ไฟแนนซ์
                </button>
              </div>
              {paymentMode === "cash" && (
                <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                  <p className="mb-3 text-sm font-bold text-white">รายละเอียดการชำระเงิน: ซื้อสด</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ราคารถ" value={form.carPrice} onChange={(value) => update("carPrice", numericOnly(value))} />
                    <Field label="หักเงินจอง" value={form.bookingDeduction} onChange={(value) => update("bookingDeduction", numericOnly(value))} />
                    <Field label="ค่าโอน" value={form.transferFee} onChange={(value) => update("transferFee", numericOnly(value))} />
                    <Field label="จ่ายสุทธิ" value={form.netPayment} onChange={(value) => update("netPayment", numericOnly(value))} />
                  </div>
                </div>
              )}
              {paymentMode === "finance" && (
                <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                  <p className="mb-3 text-sm font-bold text-white">รายละเอียดการชำระเงิน: ไฟแนนซ์</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="เงินดาวน์" value={form.downPayment} onChange={(value) => update("downPayment", numericOnly(value))} />
                    <Field label="ค่าเบี้ยประกันรถ" value={form.insuranceFee} onChange={(value) => update("insuranceFee", numericOnly(value))} />
                    <Field label="หักเงินจอง" value={form.bookingDeduction} onChange={(value) => update("bookingDeduction", numericOnly(value))} />
                    <Field label="จ่ายสุทธิ" value={form.netPayment} onChange={(value) => update("netPayment", numericOnly(value))} />
                  </div>
                </div>
              )}
              {paymentMode === "other" && (
                <TextArea label="รายละเอียดการชำระเงิน" value={form.paymentDetail} onChange={(value) => update("paymentDetail", value)} rows={4} />
              )}
              <TextArea label="เงื่อนไขการขาย" value={form.saleConditions} onChange={(value) => update("saleConditions", value)} rows={4} />
            </Panel>

            <Panel title="Gmail Draft">
              <div className="rounded-lg border border-line bg-[#0b0d11] p-3 text-sm text-soft">
                ผู้ส่งตาม Sale: <span className="font-semibold text-white">{saleEmails[form.saleName] || "ยังไม่พบ mapping"}</span> - สร้างเป็น Draft เท่านั้น ยังไม่ส่งจริง
              </div>
              <Field label="หัวข้ออีเมล" value={emailFields.subject} onChange={(value) => updateEmail("subject", value)} />
              <Field label="To" value={emailFields.to} onChange={(value) => updateEmail("to", value)} placeholder="email1@example.com, email2@example.com" />
              <Field label="CC" value={emailFields.cc} onChange={(value) => updateEmail("cc", value)} />
              <Field label="BCC" value={emailFields.bcc} onChange={(value) => updateEmail("bcc", value)} />
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
            </Panel>

            <Panel title="ไฟล์แนบ Draft รายงานขาย">
              <BookingAttachmentSummary attachments={selectedBooking?.attachments || []} />
              {(uploadProgress || driveFolderUrl) && (
                <div className="rounded-lg border border-brand/40 bg-green-950/20 p-3 text-sm text-green-100">
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

              <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">รูปรถรายงานขาย</p>
                    <p className="mt-1 text-xs text-soft">รวมซ้ายหน้า ขวาหน้า ซ้ายหลัง ขวาหลังไว้เมนูเดียว และเพิ่มได้หลายรูป</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <SalesAttachmentBox
                    category="vehiclePhotos"
                    helperText="ใส่รูป 4 มุมหลัก และเพิ่มรูปอื่นของรถได้ในเมนูนี้"
                    files={salesFiles.vehiclePhotos || []}
                    onAdd={addSalesFiles}
                    onRemove={removeSalesFile}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
                <div className="mb-3">
                  <p className="font-bold text-white">สลิปและเอกสารขาย</p>
                  <p className="mt-1 text-xs text-soft">รวมเมนูให้สั้นขึ้น เพิ่มได้หลายรูปต่อหมวด</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SalesAttachmentBox
                    category="paymentSlips"
                    helperText="ใส่รูปเงินจองและสลิปตัดยอดได้หลายรูป"
                    files={salesFiles.paymentSlips || []}
                    onAdd={addSalesFiles}
                    onRemove={removeSalesFile}
                  />
                  <SalesAttachmentBox
                    category="salesDocuments"
                    helperText="รวมลอกลาย ใบรายละเอียดการชำระเงิน/ใบเสร็จชั่วคราว และใบ KYC"
                    files={salesFiles.salesDocuments || []}
                    onAdd={addSalesFiles}
                    onRemove={removeSalesFile}
                  />
                </div>
              </div>

              <button type="submit" disabled={saving || uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-70">
                {saving || uploading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {uploading ? "กำลังอัปโหลดรูป..." : "บันทึก Draft รายงานขาย"}
              </button>
              {driveFolderUrl ? (
                <a
                  href={driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-brand/50 bg-[#0b0d11] px-4 font-bold text-brand"
                >
                  <Cloud size={20} />
                  เปิดโฟลเดอร์ Google Drive
                </a>
              ) : (
                <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-2 text-xs text-soft">
                  หลังบันทึกสำเร็จ ถ้ามีการแนบรูป ระบบจะแสดงปุ่มเปิดโฟลเดอร์ Google Drive ตรงนี้
                </p>
              )}
            </Panel>
          </form>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Preview รายงานขาย</h2>
                <p className="text-xs text-soft">ข้อความตาม template รายงานขาย</p>
              </div>
              <button type="button" onClick={copyReport} className="flex min-h-10 items-center gap-2 rounded-lg border border-brand/50 px-3 text-sm font-semibold text-brand">
                <Clipboard size={17} />
                Copy
              </button>
            </div>
            <pre className="max-h-[68vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-7 text-white">
              {reportText}
            </pre>
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
              <button
                type="button"
                onClick={sendLineReport}
                disabled={sendingLine || !selectedLineGroupId || !reportText.trim()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-base font-bold text-ink disabled:opacity-70"
              >
                {sendingLine ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                {sendingLine ? "กำลังส่ง LINE..." : "ส่ง LINE"}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </NativeAppShell>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
        <FileText size={18} className="text-brand" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BookingAttachmentSummary({ attachments }: { attachments: BookingAttachment[] }) {
  const visibleAttachments = attachments;

  return (
    <div className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">รูปจากรายงานจองเดิม</p>
          <p className="mt-1 text-xs text-soft">แสดงเฉพาะหมวดเอกสารเดิม ส่วนรูปรถให้เพิ่มใหม่ในรายงานขาย</p>
        </div>
        <span className="rounded-lg border border-line bg-panel px-2 py-1 text-xs font-semibold text-brand">{visibleAttachments.length} ไฟล์</span>
      </div>
      {visibleAttachments.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibleAttachments.map((attachment, index) => (
            <div key={`${attachment.category}-${attachment.name}-${index}`} className="rounded-lg border border-line bg-panel p-3">
              <p className="text-sm font-semibold text-white">{bookingAttachmentLabels[attachment.category]}</p>
              <p className="mt-1 truncate text-xs text-soft">{attachment.name}</p>
              {attachment.url ? (
                <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                  <Eye size={14} />
                  เปิดดูจาก Drive
                </a>
              ) : (
                <p className="mt-2 text-xs text-amber-100">ไฟล์เก่ามีเฉพาะชื่อ ยังไม่มี URL จาก Drive</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-soft">ยังไม่มีไฟล์จากรายงานจองที่ดึงมาได้</p>
      )}
    </div>
  );
}

function SalesAttachmentBox({
  category,
  helperText,
  files,
  onAdd,
  onRemove
}: {
  category: SalesAttachmentCategory;
  helperText?: string;
  files: LocalAttachment[];
  onAdd: (category: SalesAttachmentCategory, event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onRemove: (category: SalesAttachmentCategory, id: string) => void;
}) {
  const addId = `${category}-add`;
  const cameraId = `${category}-camera`;

  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{salesAttachmentLabels[category]}</p>
          <p className="mt-1 text-xs text-soft">{files.length ? `${files.length} ไฟล์` : helperText || "ยังไม่ได้เพิ่มรูป"}</p>
        </div>
        <ImagePlus size={18} className="shrink-0 text-brand" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={addId} className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white">
          <ImagePlus size={16} className="text-brand" />
          เพิ่มรูป
        </label>
        <input id={addId} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(event) => onAdd(category, event)} />

        <label htmlFor={cameraId} className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-semibold text-white">
          <Camera size={16} className="text-brand" />
          ถ่าย
        </label>
        <input id={cameraId} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(event) => onAdd(category, event)} />
      </div>

      {files.length > 0 && (
        <div className="mt-3 grid gap-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 rounded-lg border border-line bg-[#0b0d11] p-2">
              {file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-panel">
                  <FileText size={20} className="text-brand" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{file.name}</p>
                <p className="mt-1 text-[11px] text-soft">
                  {formatFileSize(file.size)}
                  {file.originalSize > file.size ? ` จาก ${formatFileSize(file.originalSize)}` : ""}
                </p>
                <div className="mt-1 flex gap-2">
                  <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                    <Eye size={14} />
                    เปิดดู
                  </a>
                  {file.driveUrl && (
                    <a href={file.driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-green-200">
                      <Cloud size={14} />
                      Drive
                    </a>
                  )}
                  <button type="button" onClick={() => onRemove(category, file.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-200">
                    <X size={14} />
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-h-24 w-full resize-y rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}
