import type { SalesReportInput } from "@/lib/types";

export type SalesReportFixture = Omit<SalesReportInput, "status"> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

export const DUPLICATE_UX_FIXTURE_REPORTS: SalesReportFixture[] = [
  {
    id: "SR-FIXTURE-20260801-001",
    createdAt: "2026-08-01T09:30:00+07:00",
    updatedAt: "2026-08-01T09:30:00+07:00",
    status: "บันทึกแล้ว",
    bookingReportId: "BR-FIXTURE-OLD-001",
    customerName: "ลูกค้าตัวอย่าง",
    phone: "0917785117",
    idCard: "0123456789012",
    address: "กรุงเทพมหานคร",
    bookingPrice: "10000",
    plate: "1กก 1234",
    brand: "TOYOTA",
    model: "COMMUTER",
    year: "2022",
    color: "ขาว",
    engineNo: "ENG-FIXTURE-001",
    chassisNo: "VIN-FIXTURE-001",
    salePrice: "650000",
    centralDiscount: "15000",
    finalPrice: "635000",
    paymentType: "ไฟแนนซ์",
    source: "หน้าร้าน",
    ownership: "บริษัท",
    project: "รถทดลอง",
    carPrice: "650000",
    bookingDeduction: "10000",
    transferFee: "2000",
    netPayment: "625000",
    downPayment: "100000",
    insuranceFee: "12000",
    paymentDetail: "ข้อมูลธุรกรรมเดิมที่ต้องไม่ถูกคัดลอก",
    saleConditions: "",
    saleName: "ฐากร",
    teamName: "พี่ลีฟ",
    branch: "บางนา",
    deliveryDate: "2026-08-10",
    reportText: "fixture old report text"
  }
];

export function normalizeSalesPlate(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeCustomer(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("th");
}

export function findDuplicateTransactions(input: Pick<SalesReportInput, "plate" | "customerName">, reports: SalesReportFixture[]) {
  const plate = normalizeSalesPlate(input.plate);
  const customer = normalizeCustomer(input.customerName);
  if (!plate || !customer) return [];
  return reports.filter((report) => normalizeSalesPlate(report.plate) === plate && normalizeCustomer(report.customerName) === customer);
}

/** Copy only stable/reviewable business inputs. Transaction state is intentionally rebuilt blank. */
export function createFixtureDraftFromExisting(source: SalesReportFixture): SalesReportInput {
  return {
    bookingReportId: "",
    customerName: source.customerName,
    phone: source.phone,
    idCard: source.idCard,
    address: source.address,
    bookingPrice: "",
    plate: source.plate,
    brand: source.brand,
    model: source.model,
    year: source.year,
    color: source.color,
    engineNo: source.engineNo,
    chassisNo: source.chassisNo,
    salePrice: source.salePrice,
    centralDiscount: "",
    finalPrice: "",
    paymentType: "",
    source: source.source,
    ownership: source.ownership,
    project: source.project,
    carPrice: "",
    bookingDeduction: "",
    transferFee: "",
    netPayment: "",
    downPayment: "",
    insuranceFee: "",
    paymentDetail: "",
    saleConditions: "",
    saleName: source.saleName,
    teamName: source.teamName,
    branch: source.branch,
    deliveryDate: "",
    reportText: "",
    status: "draft"
  };
}

export function fixtureDraftId(sourceId: string) {
  return `NEW-FIXTURE-FROM-${sourceId}`;
}
