"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Eraser, FileText, Loader2, Search, Save, Send, X } from "lucide-react";
import { AppHeader } from "@/app/components/ui";
import { useSalesProfile } from "@/lib/use-sales-profile";
import type { ApprovalBooking, ApprovalStaff, ApprovalStockVehicle, LineGroup } from "@/lib/types";

type FormType =
  | "ขอประวัติศูนย์"
  | "ขอสำเนาทะเบียน"
  | "ขอปรับสภาพก่อน"
  | "แจ้งงานประกัน"
  | "ขออนุมัติโอนเอง"
  | "ขอเบิกกุญแจ";

type ApprovalForm = {
  formType: FormType;
  plate: string;
  plates: string;
  vin: string;
  model: string;
  registeredYear: string;
  finalGrade: string;
  project: string;
  program: string;
  salePrice: string;
  parkingLocation: string;
  purchaseType: string;
  customerName: string;
  address: string;
  phone: string;
  insuranceCompany: string;
  insuranceClass: string;
  insuranceCapital: string;
  shippingAddress: string;
  location: string;
  salePriceFinal: string;
  insurance: string;
  ewInsurance: string;
  transferOwnership: string;
  approvalAmount: string;
  branch: string;
  saleName: string;
  extraSales: string;
};

const formTypes: FormType[] = [
  "ขอประวัติศูนย์",
  "ขอสำเนาทะเบียน",
  "ขอปรับสภาพก่อน",
  "แจ้งงานประกัน",
  "ขออนุมัติโอนเอง",
  "ขอเบิกกุญแจ"
];

const blankForm: ApprovalForm = {
  formType: "ขอประวัติศูนย์",
  plate: "",
  plates: "",
  vin: "",
  model: "",
  registeredYear: "",
  finalGrade: "",
  project: "",
  program: "",
  salePrice: "",
  parkingLocation: "",
  purchaseType: "ซื้อสด",
  customerName: "",
  address: "",
  phone: "",
  insuranceCompany: "",
  insuranceClass: "",
  insuranceCapital: "",
  shippingAddress: "",
  location: "สาขาบางนา",
  salePriceFinal: "",
  insurance: "",
  ewInsurance: "",
  transferOwnership: "",
  approvalAmount: "",
  branch: "สาขาบางนา",
  saleName: "บิ๊ก",
  extraSales: ""
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

function todayText() {
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}

function timestampText() {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function selectedStaff(staff: ApprovalStaff[], nickname: string) {
  return staff.find((item) => item.nickname === nickname) || null;
}

function buildMessage(form: ApprovalForm, staff: ApprovalStaff[]) {
  const staffData = selectedStaff(staff, form.saleName);
  const fullName = staffData?.fullName || form.saleName;
  const staffPhone = staffData?.phone || "";
  const branch = staffData?.branch || form.branch;
  const team = staffData?.team || "รองสฤษดิ์";

  if (form.formType === "ขอประวัติศูนย์") {
    return `เรียนพี่เจี๊ยบ

            สาขาบางนาขอประวัติศูนย์ ทะเบียน (${form.plate}) เลขตัวถัง (${form.vin})

รองสฤษดิ์

สาขาบางนา`;
  }

  if (form.formType === "ขอสำเนาทะเบียน") {
    return `รบกวนขอสำเนาทะเบียน
${form.plate}
${form.vin}`;
  }

  if (form.formType === "ขอปรับสภาพก่อน") {
    return `เรียนพี่เบญ
${todayText()}

ขออนุญาตส่งรถไปปรับสภาพก่อน
เหลือรอแค่ลายเซ็นคุณกัส

ทะเบียน
${form.plate} (${form.purchaseType})

รถจอด ${form.parkingLocation}

เพื่อความรวดเร็วและส่งมอบ
ได้ไวตามฤกษ์ลูกค้าครับ

เซลล์${form.saleName}
ทีม${team} (${branch})`;
  }

  if (form.formType === "แจ้งงานประกัน") {
    return `การแจ้งงาน
วันที่แจ้ง: ${timestampText()}
สถานที่: ${form.location}

ชื่อผู้เอาประกัน : ${form.customerName}
ที่อยู่หน้าตารางกรมธรรม์ : ${form.address}
เบอร์โทร : ${form.phone}
ทะเบียน : ${form.plate}
บริษัทประกัน : ${form.insuranceCompany}
ชั้นประกัน : ${form.insuranceClass}
ทุนประกัน : ${form.insuranceCapital}
ที่อยู่จัดส่งเอกสาร : ${form.shippingAddress}

ชื่อผู้แจ้งงาน
${fullName}
${staffPhone}`;
  }

  if (form.formType === "ขออนุมัติโอนเอง") {
    return `รบกวนกรอกข้อมูลในกรณีขออนุมัติต่างๆ และแจ้งล่วงหน้าอย่างน้อย 1 วันนะครับ

เรื่องที่ขออนุมัติ = ขออนุมัติโอนเอง
ทะเบียน = ${form.plate}
ยี่ห้อ/รุ่น = ${form.model}
ปีจดทะเบียน = ${form.registeredYear}
เกรด Final = ${form.finalGrade}
กลุ่ม Project = ${form.project}
PROGRAM = ${form.program}
ประกันภัย = ${form.insurance}
ประกัน EW = ${form.ewInsurance}
ราคาตั้งขาย = ${form.salePrice}
ราคาขาย = ${form.salePriceFinal}
การโอนกรรมสิทธิ์ = ${form.transferOwnership}

จำนวนเงินที่ขออนุมัติ = ${form.approvalAmount}
(ก่อน VAT.) -`;
  }

  const plateLines = form.plates.trim() || form.plate;
  const saleLines = [form.saleName, form.extraSales].filter(Boolean).join("\n");

  return `เรียนคุณเบญ

${todayText()}
ขอเบิกกุญแจ${form.branch}ให้ลูกค้าดูครับ
โดยคืนในวันถัดไป ภายใน 9.00
และเซลล์ออกนอกพื้นที่ก่อน 18.00

ทะเบียน
${plateLines}

เซลล์ ${saleLines}`;
}

export default function ApprovalFormsPage() {
  const { user: salesProfile } = useSalesProfile();
  const [form, setForm] = useState<ApprovalForm>(blankForm);
  const [staff, setStaff] = useState<ApprovalStaff[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [selectedLineGroupId, setSelectedLineGroupId] = useState("");
  const [lookupDebug, setLookupDebug] = useState<{
    booking: ApprovalBooking;
    vehicle: ApprovalStockVehicle | null;
  } | null>(null);
  const [lookupStatus, setLookupStatus] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [sendingLine, setSendingLine] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const staffWithProfile = useMemo(() => {
    if (!salesProfile) return staff;
    const nickname = salesProfile.nickname || salesProfile.firstName || blankForm.saleName;
    const profileStaff: ApprovalStaff = {
      nickname,
      fullName: [salesProfile.firstName, salesProfile.lastName].filter(Boolean).join(" ").trim() || nickname,
      phone: salesProfile.phone,
      team: "พี่ลีฟ",
      branch: salesProfile.branch || blankForm.branch
    };
    return [profileStaff, ...staff.filter((item) => item.nickname !== nickname)];
  }, [salesProfile, staff]);

  const preview = useMemo(() => buildMessage(form, staffWithProfile), [form, staffWithProfile]);

  useEffect(() => {
    api<{ staff: ApprovalStaff[] }>("/api/approval/staff")
      .then((data) => setStaff(data.staff))
      .catch(() => setStaff([]));
    api<{ groups: LineGroup[] }>("/api/line/groups")
      .then((data) => {
        setLineGroups(data.groups);
        setSelectedLineGroupId(data.groups[0]?.groupId || "");
      })
      .catch(() => setLineGroups([]));
  }, []);

  useEffect(() => {
    if (!salesProfile) return;
    setForm((current) => ({
      ...current,
      saleName:
        !current.saleName || current.saleName === blankForm.saleName
          ? salesProfile.nickname || salesProfile.firstName || current.saleName
          : current.saleName,
      branch: current.branch || salesProfile.branch || blankForm.branch,
      location: current.location || salesProfile.branch || blankForm.location
    }));
  }, [salesProfile]);

  function update<K extends keyof ApprovalForm>(field: K, value: ApprovalForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyStock(vehicle: ApprovalStockVehicle | null) {
    if (!vehicle) return;
    setForm((current) => ({
      ...current,
      plate: vehicle.plate || current.plate,
      vin: vehicle.vin || current.vin,
      model: vehicle.model || current.model,
      registeredYear: vehicle.registeredYear || current.registeredYear,
      finalGrade: vehicle.finalGrade || current.finalGrade,
      project: vehicle.project || current.project,
      program: vehicle.program || current.program,
      salePrice: vehicle.salePrice || current.salePrice,
      parkingLocation: vehicle.parkingLocation || current.parkingLocation
    }));
  }

  function applyBooking(booking: ApprovalBooking) {
    if (!booking) return;
    setForm((current) => ({
      ...current,
      customerName: booking.customerName || current.customerName,
      address: booking.address || current.address,
      phone: booking.phone || current.phone,
      shippingAddress: booking.address || current.shippingAddress
    }));
  }

  async function lookupPlate() {
    const plate = form.plate.trim();
    if (!plate) return;

    setLoadingLookup(true);
    setError("");
    setMessage("");
    setLookupStatus("");
    setLookupDebug(null);

    try {
      const data = await api<{ vehicle: ApprovalStockVehicle | null; booking: ApprovalBooking }>(
        `/api/approval/lookup?plate=${encodeURIComponent(plate)}`
      );
      setLookupDebug({ vehicle: data.vehicle, booking: data.booking });
      applyStock(data.vehicle);
      applyBooking(data.booking);

      if (data.vehicle && data.booking) setLookupStatus(data.vehicle.vin ? "ดึงข้อมูลจาก Stock และ Booking สำเร็จ พร้อมเลขตัวถัง" : "ดึงข้อมูลจาก Stock และ Booking สำเร็จ แต่ยังไม่มีเลขตัวถัง");
      else if (data.vehicle) setLookupStatus(data.vehicle.vin ? "ดึงข้อมูลจาก Stock สำเร็จ พร้อมเลขตัวถัง" : "ดึงข้อมูลจาก Stock สำเร็จ แต่ยังไม่มีเลขตัวถัง");
      else if (data.booking) setLookupStatus("ดึงข้อมูลจาก Booking สำเร็จ แต่ไม่พบข้อมูลใน Stock");
      else setLookupStatus("ไม่พบข้อมูลใน Stock / Booking สามารถกรอกเองได้");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นหาทะเบียนไม่สำเร็จ");
    } finally {
      setLoadingLookup(false);
    }
  }

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("Generate ข้อความแล้ว ตรวจ Preview ก่อนส่ง LINE");
  }

  async function copyPreview() {
    setCopying(true);
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(preview);
      setMessage("คัดลอกข้อความแล้ว");
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความใน Preview แล้ว copy เอง");
    } finally {
      window.setTimeout(() => setCopying(false), 500);
    }
  }

  async function saveLog() {
    setSavingLog(true);
    setError("");
    setMessage("");
    try {
      await api("/api/approval/logs", {
        method: "POST",
        body: JSON.stringify({
          formType: form.formType,
          plate: form.formType === "ขอเบิกกุญแจ" ? form.plates || form.plate : form.plate,
          saleName: form.saleName,
          message: preview
        })
      });
      setMessage("บันทึกประวัติลง ApprovalLogs แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึก Log ไม่สำเร็จ");
    } finally {
      setSavingLog(false);
    }
  }

  async function sendLine() {
    setSendingLine(true);
    setError("");
    setMessage("");

    try {
      if (!selectedLineGroupId) throw new Error("กรุณาเลือกกลุ่ม LINE ก่อนส่ง");
      await api("/api/line/test-send", {
        method: "POST",
        body: JSON.stringify({
          groupId: selectedLineGroupId,
          message: preview
        })
      });
      await api("/api/approval/logs", {
        method: "POST",
        body: JSON.stringify({
          formType: form.formType,
          plate: form.formType === "ขอเบิกกุญแจ" ? form.plates || form.plate : form.plate,
          saleName: form.saleName,
          message: `[ส่ง LINE] ${preview}`
        })
      }).catch(() => undefined);
      setMessage("ส่งข้อความฟอร์มอนุมัติเข้า LINE แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง LINE ไม่สำเร็จ");
    } finally {
      setSendingLine(false);
    }
  }

  function clearForm() {
    setForm({
      ...blankForm,
      formType: form.formType,
      saleName: salesProfile?.nickname || salesProfile?.firstName || blankForm.saleName,
      branch: salesProfile?.branch || blankForm.branch,
      location: salesProfile?.branch || blankForm.location
    });
    setLookupStatus("");
    setLookupDebug(null);
    setMessage("");
    setError("");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <AppHeader
        title="อนุมัติ"
        subtitle={salesProfile ? `ใช้โปรไฟล์เซลล์: ${salesProfile.nickname}` : "Generate ข้อความสำหรับ LINE พร้อมบันทึกประวัติแบบ Draft / Preview"}
      />

      {(message || error || lookupStatus) && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-400/40 bg-red-950/30 text-red-100" : "border-brand/40 bg-green-950/30 text-green-100"}`}>
          {error ? <X size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{error || message || lookupStatus}</span>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
        <form onSubmit={generate} className="space-y-4 rounded-lg border border-line bg-panel p-4 shadow-glow">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">เลือกประเภทฟอร์ม</span>
            <select
              value={form.formType}
              onChange={(event) => update("formType", event.target.value as FormType)}
              className="min-h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
            >
              {formTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          {form.formType !== "ขอเบิกกุญแจ" && (
            <section className="rounded-lg border border-line bg-[#0b0d11] p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Field label="ทะเบียน" value={form.plate} onChange={(value) => update("plate", value)} placeholder="3ฒฒ 4923" />
                <button type="button" onClick={lookupPlate} disabled={loadingLookup || !form.plate.trim()} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-60">
                  {loadingLookup ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                  ค้น Stock
                </button>
              </div>
              {lookupDebug && (
                <div className="mt-3 rounded-lg border border-line bg-[#080a0d] p-3 text-xs text-soft">
                  <p className="font-semibold text-white">ตรวจข้อมูลที่ระบบดึงกลับมา</p>
                  <div className="mt-2 grid gap-1">
                    <p>เจอ Stock: <span className="text-white">{lookupDebug.vehicle ? "ใช่" : "ไม่เจอ"}</span></p>
                    <p>เลขตัวถัง/Vin: <span className="break-all text-white">{lookupDebug.vehicle?.vin || "-"}</span></p>
                    <p>รุ่น: <span className="text-white">{lookupDebug.vehicle?.model || "-"}</span></p>
                    <p>เจอ Booking: <span className="text-white">{lookupDebug.booking ? "ใช่" : "ไม่เจอ"}</span></p>
                  </div>
                </div>
              )}
            </section>
          )}

          {(form.formType === "ขอประวัติศูนย์" || form.formType === "ขอสำเนาทะเบียน") && (
            <Panel title="ข้อมูลรถ">
              <Field label="เลขตัวถัง" value={form.vin} onChange={(value) => update("vin", value)} />
            </Panel>
          )}

          {form.formType === "ขอปรับสภาพก่อน" && (
            <Panel title="ข้อมูลปรับสภาพ">
              <Field label="ประเภทซื้อ" value={form.purchaseType} onChange={(value) => update("purchaseType", value)} placeholder="ซื้อสด / จัดไฟแนนซ์" />
              <Field label="สถานที่จอด" value={form.parkingLocation} onChange={(value) => update("parkingLocation", value)} />
              <StaffSelect label="เซลล์" value={form.saleName} staff={staffWithProfile} onChange={(value) => update("saleName", value)} />
            </Panel>
          )}

          {form.formType === "แจ้งงานประกัน" && (
            <>
              <Panel title="ข้อมูลลูกค้า">
                <Field label="ชื่อลูกค้า" value={form.customerName} onChange={(value) => update("customerName", value)} />
                <Field label="เบอร์โทร" value={form.phone} onChange={(value) => update("phone", value)} inputMode="tel" />
                <Field label="ที่อยู่" value={form.address} onChange={(value) => update("address", value)} />
                <Field label="ที่อยู่จัดส่งเอกสาร" value={form.shippingAddress} onChange={(value) => update("shippingAddress", value)} />
              </Panel>
              <Panel title="ข้อมูลประกัน">
                <Field label="บริษัทประกัน" value={form.insuranceCompany} onChange={(value) => update("insuranceCompany", value)} />
                <Field label="ชั้นประกัน" value={form.insuranceClass} onChange={(value) => update("insuranceClass", value)} />
                <Field label="ทุนประกัน" value={form.insuranceCapital} onChange={(value) => update("insuranceCapital", value)} inputMode="tel" />
                <Field label="สถานที่" value={form.location} onChange={(value) => update("location", value)} />
                <StaffSelect label="เซลล์" value={form.saleName} staff={staffWithProfile} onChange={(value) => update("saleName", value)} />
              </Panel>
            </>
          )}

          {form.formType === "ขออนุมัติโอนเอง" && (
            <>
              <Panel title="ข้อมูลจาก Stock">
                <Field label="ยี่ห้อ/รุ่น" value={form.model} onChange={(value) => update("model", value)} />
                <Field label="ปีจดทะเบียน" value={form.registeredYear} onChange={(value) => update("registeredYear", value)} />
                <Field label="เกรด Final" value={form.finalGrade} onChange={(value) => update("finalGrade", value)} />
                <Field label="Project" value={form.project} onChange={(value) => update("project", value)} />
                <Field label="Program" value={form.program} onChange={(value) => update("program", value)} />
                <Field label="ราคาตั้งขาย" value={form.salePrice} onChange={(value) => update("salePrice", value)} inputMode="tel" />
              </Panel>
              <Panel title="ข้อมูลอนุมัติ">
                <Field label="ประกันภัย" value={form.insurance} onChange={(value) => update("insurance", value)} />
                <Field label="ประกัน EW" value={form.ewInsurance} onChange={(value) => update("ewInsurance", value)} />
                <Field label="ราคาขาย" value={form.salePriceFinal} onChange={(value) => update("salePriceFinal", value)} inputMode="tel" />
                <Field label="การโอนกรรมสิทธิ์" value={form.transferOwnership} onChange={(value) => update("transferOwnership", value)} />
                <Field label="จำนวนเงินที่ขออนุมัติ" value={form.approvalAmount} onChange={(value) => update("approvalAmount", value)} inputMode="tel" />
              </Panel>
            </>
          )}

          {form.formType === "ขอเบิกกุญแจ" && (
            <Panel title="ข้อมูลเบิกกุญแจ">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">สาขา</span>
                <select value={form.branch} onChange={(event) => update("branch", event.target.value)} className="min-h-12 w-full rounded-lg border border-line bg-[#080a0d] px-3 text-white outline-none focus:border-brand">
                  <option>สาขาบางนา</option>
                  <option>สาขาเทพารักษ์</option>
                </select>
              </label>
              <TextArea label="ทะเบียนหลายคัน" value={form.plates} onChange={(value) => update("plates", value)} placeholder="กรอกทะเบียน คันละ 1 บรรทัด" />
              <StaffSelect label="เซลล์หลัก" value={form.saleName} staff={staffWithProfile} onChange={(value) => update("saleName", value)} />
              <TextArea label="เซลล์เพิ่มเติม" value={form.extraSales} onChange={(value) => update("extraSales", value)} placeholder="กรอกเพิ่มได้หลายคน คนละ 1 บรรทัด" />
            </Panel>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <button type="submit" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink">
              <FileText size={20} />
              Generate ข้อความ
            </button>
            <button type="button" onClick={clearForm} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-4 font-semibold text-white">
              <Eraser size={18} />
              Clear
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Preview</p>
                <h2 className="mt-1 text-lg font-bold text-white">ข้อความสำเร็จรูป</h2>
              </div>
              <span className="rounded-full border border-line bg-[#0b0d11] px-3 py-1 text-xs text-soft">LINE Draft</span>
            </div>
            <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0d11] p-3 text-sm leading-7 text-white">{preview}</pre>
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
              <button type="button" onClick={sendLine} disabled={sendingLine || !selectedLineGroupId || !preview.trim()} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-70">
                {sendingLine ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                ส่ง LINE
              </button>
              <button type="button" onClick={copyPreview} disabled={copying} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-ink disabled:opacity-70">
                {copying ? <Loader2 size={20} className="animate-spin" /> : <Clipboard size={20} />}
                Copy ข้อความ
              </button>
              <button type="button" onClick={saveLog} disabled={savingLog} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand/50 px-4 font-semibold text-brand disabled:opacity-70">
                {savingLog ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Save Log
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-[#0b0d11] p-3">
      <h2 className="mb-3 text-base font-bold text-white">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "text" | "tel" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="min-h-12 w-full rounded-lg border border-line bg-[#080a0d] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block sm:col-span-2">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="min-h-28 w-full resize-y rounded-lg border border-line bg-[#080a0d] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand" />
    </label>
  );
}

function StaffSelect({ label, value, staff, onChange }: { label: string; value: string; staff: ApprovalStaff[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full rounded-lg border border-line bg-[#080a0d] px-3 text-white outline-none focus:border-brand">
        {[...staff.map((item) => item.nickname), "เพิ่มเอง"].map((name) => <option key={name}>{name}</option>)}
      </select>
    </label>
  );
}
