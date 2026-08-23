import type { ReportHistoryItem, SalesReportInput } from "@/lib/types";

export type CustomerIdentity =
  | { type: "citizen_or_tax_id"; value: string }
  | { type: "customer_name"; value: string }
  | { type: "unproven"; value: "" };

export type SalesDuplicateMatch = {
  salesReportId: string;
  saleDate: string;
  customerName: string;
  plate: string;
  salespersonDisplayName: string;
  status: string;
};

export type SalesDuplicateCheck = {
  requiresConfirmation: boolean;
  normalizedPlate: string;
  customerIdentityType: CustomerIdentity["type"];
  matches: SalesDuplicateMatch[];
  confirmationToken?: string;
};

export function normalizeSalesPlate(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function resolveSalesCustomerIdentity(input: Pick<SalesReportInput, "idCard" | "customerName">): CustomerIdentity {
  const identifier = String(input.idCard || "").trim();
  if (identifier) return { type: "citizen_or_tax_id", value: identifier };
  const name = String(input.customerName || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
  return name ? { type: "customer_name", value: name } : { type: "unproven", value: "" };
}

export function isSameProvenSalesCustomer(
  left: Pick<SalesReportInput, "idCard" | "customerName">,
  right: Pick<SalesReportInput, "idCard" | "customerName">
) {
  const a = resolveSalesCustomerIdentity(left);
  const b = resolveSalesCustomerIdentity(right);
  return a.type !== "unproven" && a.type === b.type && a.value === b.value;
}

export function requiresSalesDuplicateConfirmation(
  draft: Pick<SalesReportInput, "idCard" | "customerName" | "plate">,
  existing: Pick<SalesReportInput, "idCard" | "customerName" | "plate">
) {
  return normalizeSalesPlate(draft.plate) === normalizeSalesPlate(existing.plate)
    && isSameProvenSalesCustomer(draft, existing);
}

export function createSalesRequestId() {
  return crypto.randomUUID();
}

export function copySalesReportForNewTransaction(source: Partial<SalesReportInput> | ReportHistoryItem): SalesReportInput {
  return {
    bookingReportId: "",
    customerName: String(source.customerName || ""),
    phone: String(source.phone || ""),
    idCard: String(source.idCard || ""),
    address: String(source.address || ""),
    bookingPrice: "",
    plate: String(source.plate || ""),
    brand: String(source.brand || ""),
    model: String(source.model || ""),
    year: String(source.year || ""),
    color: String(source.color || ""),
    engineNo: String(source.engineNo || ""),
    chassisNo: String(source.chassisNo || ""),
    salePrice: String(source.salePrice || ""),
    centralDiscount: "",
    finalPrice: "",
    paymentType: "",
    source: String(source.source || ""),
    ownership: String(source.ownership || ""),
    project: String(source.project || ""),
    carPrice: String(("carPrice" in source ? source.carPrice : "") || source.salePrice || ""),
    bookingDeduction: "",
    transferFee: "",
    netPayment: "",
    downPayment: "",
    insuranceFee: "",
    paymentDetail: "",
    saleConditions: "",
    saleName: String(source.saleName || ""),
    teamName: String(source.teamName || ""),
    branch: String(source.branch || ""),
    deliveryDate: "",
    emailSubject: "",
    emailTo: "",
    emailCc: "",
    emailBcc: "",
    attachments: [],
    driveFolderUrl: "",
    reportText: "",
    status: "draft"
  };
}
