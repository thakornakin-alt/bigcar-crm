export type Customer = {
  no: string;
  date: string;
  car: string;
  name: string;
  phone: string;
  note: string;
  rowIndex: number;
};

export type CustomerInput = {
  car: string;
  name: string;
  phone: string;
  note: string;
};

export type InterestRate = {
  vehicleType: string;
  yearRange: string;
  months48: number | null;
  months60: number | null;
  months72: number | null;
  months84: number | null;
  commission: number;
};

export type InstallmentRow = {
  label: string;
  downRate: number | null;
  downPayment: number;
  financeAmount: number;
  payments: {
    months48: number;
    months60: number;
    months72: number;
    months84: number;
  };
};

export type BuyerType = "individual" | "company";

export type BookingReportInput = {
  customerName: string;
  idCard: string;
  phone: string;
  address: string;
  buyerType: BuyerType;
  bookingPrice: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  salePrice: string;
  finalPrice: string;
  finalPriceNote: string;
  discount: string;
  paymentType: string;
  source: string;
  ownership: string;
  project: string;
  campaign: string;
  saleName: string;
  teamName: string;
  conditions: string;
  emailSubject: string;
  emailTo: string;
  emailCc: string;
  emailBcc: string;
  attachments?: BookingAttachment[];
  reportText: string;
  status: "draft" | "send_cancelled" | "staging_preview";
};

export type BookingReport = BookingReportInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type StockVehicle = {
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  salePrice: string;
  source: string;
  ownership: string;
  project: string;
  campaign: string;
};

export type StockImportInput = {
  rows: StockVehicle[];
  sourceName: string;
  clearExisting?: boolean;
};

export type StockImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  importedAt: string;
};

export type StockImportStatus = {
  total: number;
  latestImportedAt: string;
  latestUpdatedAt: string;
};

export type CustomerLookup = {
  customerName: string;
  phone: string;
  address: string;
} | null;

export type BookingAttachmentCategory =
  | "bookingSlip"
  | "bookingCondition"
  | "carPhoto"
  | "idCard"
  | "companyCertificate";

export type BookingAttachment = {
  category: BookingAttachmentCategory;
  name: string;
  type: string;
  size: number;
};
