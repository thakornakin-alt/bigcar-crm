import type { SalesUser, StockVehicle } from "./types.ts";

export type BookingFinanceCreditStatus = "" | "มี" | "ไม่มี" | "ไม่ทราบ";

export type BookingFinanceSigningInput = {
  financeCompany: string;
  signingLocation: string;
  occupation: string;
  employmentDuration: string;
  income: string;
  creditStatus: BookingFinanceCreditStatus;
  financePrice: string;
  financePriceSource: "" | "stock" | "manual";
  downPayment: string;
};

export const blankBookingFinanceSigning: BookingFinanceSigningInput = {
  financeCompany: "",
  signingLocation: "",
  occupation: "",
  employmentDuration: "",
  income: "",
  creditStatus: "",
  financePrice: "",
  financePriceSource: "",
  downPayment: ""
};

export function parseFinanceMoney(value: unknown): number | null {
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatFinanceMoney(value: unknown): string {
  const parsed = typeof value === "number" ? value : parseFinanceMoney(value);
  return parsed === null || !Number.isFinite(parsed) ? "" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed);
}

export function autofillFinancePriceFromStock(finance: BookingFinanceSigningInput, stockPrice: unknown) {
  if (finance.financePrice.trim() || finance.financePriceSource === "manual") return finance;
  const parsed = parseFinanceMoney(stockPrice);
  if (parsed === null) return finance;
  return { ...finance, financePrice: String(parsed), financePriceSource: "stock" as const };
}

export function calculateFinanceAmountBeforeVat(financePrice: unknown, downPayment: unknown) {
  const price = parseFinanceMoney(financePrice);
  const down = parseFinanceMoney(downPayment);
  if (String(financePrice ?? "").trim() === "") return { amount: null, error: "กรุณาระบุราคารถสำหรับจัดไฟแนนซ์" };
  if (price === null) return { amount: null, error: "กรุณากรอกราคารถสำหรับจัดไฟแนนซ์เป็นตัวเลข" };
  if (String(downPayment ?? "").trim() === "") return { amount: null, error: "" };
  if (down === null) return { amount: null, error: "กรุณากรอกเงินดาวน์เป็นตัวเลข" };
  if (down > price) return { amount: null, error: "เงินดาวน์ต้องไม่มากกว่าราคารถสำหรับจัดไฟแนนซ์" };
  return { amount: price - down, error: "" };
}

function salesName(user: Pick<SalesUser, "firstName" | "lastName" | "nickname"> | null, fallback: string) {
  const name = user?.firstName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || fallback.trim();
  const nickname = user?.nickname?.trim();
  return nickname ? `${name} (${nickname})` : name;
}

function teamBranch(teamName: string, branch: string) {
  const cleanBranch = branch.trim().replace(/^สาขา\s*/u, "");
  return [teamName.trim(), cleanBranch].filter(Boolean).join(" ");
}

export function renderBookingFinanceSigningPreview(input: {
  finance: BookingFinanceSigningInput;
  customerName: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  teamName: string;
  owner: Pick<SalesUser, "firstName" | "lastName" | "nickname" | "branch"> | null;
  fallbackSaleName: string;
  stockVehicle?: Pick<StockVehicle, "salePrice"> | null;
}) {
  const financePrice = parseFinanceMoney(input.finance.financePrice);
  const financeAmount = calculateFinanceAmountBeforeVat(input.finance.financePrice, input.finance.downPayment);
  return [
    "ส่งงานเซ็นไฟแนนซ์",
    `ไฟแนนซ์ : ${input.finance.financeCompany}`,
    `สถานที่นัดเซ็น : ${input.finance.signingLocation}`,
    "",
    `ชื่อเซล : ${salesName(input.owner, input.fallbackSaleName)}`,
    `ทีม : ${teamBranch(input.teamName, input.owner?.branch || "")}`,
    "",
    `ชื่อลูกค้า : ${input.customerName}`,
    `อาชีพ : ${input.finance.occupation}`,
    `อายุงาน : ${input.finance.employmentDuration}`,
    `รายได้ : ${formatFinanceMoney(input.finance.income)}`,
    `ลูกค้ามีเครดิตหรือไม่ : ${input.finance.creditStatus}`,
    "",
    `ทะเบียนรถ : ${input.plate}`,
    `ยี่ห้อรถ : ${input.brand}`,
    `รุ่น : ${input.model}`,
    `ปี : ${input.year}`,
    "ดีลเลอร์ : อาคเนย์แคปปิตอล",
    "",
    `ราคาขาย : ${financePrice === null ? "" : formatFinanceMoney(financePrice)}`,
    `เงินดาวน์ : ${formatFinanceMoney(input.finance.downPayment)}`,
    `ยอดจัด (ก่อน VAT) : ${financeAmount.amount === null ? (financeAmount.error || "") : formatFinanceMoney(financeAmount.amount)}`,
    "",
    "ดอกเบี้ย : ปิดตามโปรไฟล์ลูกค้า",
    "จำนวนงวด : ปิดตามหน้างาน",
    "ประกันภัยรถยนต์ : ปิดตามหน้างาน"
  ].join("\n");
}
