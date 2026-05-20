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

export type SalesReportInput = {
  bookingReportId: string;
  customerName: string;
  phone: string;
  idCard: string;
  address: string;
  bookingPrice: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  salePrice: string;
  centralDiscount: string;
  finalPrice: string;
  paymentType: string;
  source: string;
  ownership: string;
  project: string;
  carPrice: string;
  bookingDeduction: string;
  transferFee: string;
  netPayment: string;
  downPayment: string;
  insuranceFee: string;
  paymentDetail: string;
  saleConditions: string;
  saleName: string;
  teamName: string;
  branch: string;
  deliveryDate: string;
  emailSubject?: string;
  emailTo?: string;
  emailCc?: string;
  emailBcc?: string;
  emailStatus?: string;
  emailDraftId?: string;
  attachments?: DriveAttachment[];
  driveFolderUrl?: string;
  reportText: string;
  status: "draft" | "staging_preview";
};

export type SalesReport = SalesReportInput & {
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
  vin?: string;
  finalGrade?: string;
  program?: string;
  parkingLocation?: string;
  status?: string;
  gear?: string;
  mileage?: string;
  pdiNote?: string;
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
  clientVinRows?: number;
  vinReceived?: number;
  vinWritten?: number;
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
  clientId?: string;
  category: BookingAttachmentCategory;
  label?: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  fileId?: string;
  folderUrl?: string;
  uploadedAt?: string;
};

export type DriveAttachment = {
  clientId?: string;
  category: string;
  label: string;
  name: string;
  type: string;
  size: number;
  url: string;
  fileId: string;
  folderUrl: string;
  uploadedAt: string;
};

export type DriveUploadFile = {
  clientId: string;
  category: string;
  label: string;
  name: string;
  type: string;
  size: number;
  base64: string;
};

export type DriveUploadInput = {
  reportType: "sales" | "booking";
  customerName: string;
  plate: string;
  saleName: string;
  files: DriveUploadFile[];
};

export type DriveUploadResult = {
  folderUrl: string;
  attachments: DriveAttachment[];
};

export type EmailDraftInput = {
  reportId?: string;
  subject: string;
  to: string;
  cc?: string;
  bcc?: string;
  body: string;
  attachments?: Array<Pick<DriveAttachment, "fileId" | "name">>;
};

export type EmailDraftResult = {
  draftId: string;
  draftUrl: string;
  status: string;
};

export type ReportHistoryType = "booking" | "sales";

export type ReportHistoryItem = {
  id: string;
  type: ReportHistoryType;
  createdAt: string;
  updatedAt: string;
  status: string;
  customerName: string;
  phone: string;
  idCard: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  saleName: string;
  teamName: string;
  emailSubject: string;
  emailTo: string;
  emailCc: string;
  emailStatus: string;
  lineStatus: string;
  ocrStatus: string;
  emailDraftId: string;
  driveFolderUrl: string;
  attachments: Array<BookingAttachment | DriveAttachment>;
  reportText: string;
};

export type ApprovalStaff = {
  nickname: string;
  fullName: string;
  phone: string;
  team: string;
  branch: string;
};

export type ApprovalStockVehicle = {
  plate: string;
  vin: string;
  model: string;
  registeredYear: string;
  finalGrade: string;
  project: string;
  program: string;
  salePrice: string;
  parkingLocation: string;
};

export type ApprovalBooking = {
  plate: string;
  customerName: string;
  address: string;
  phone: string;
} | null;

export type ApprovalLogInput = {
  formType: string;
  plate: string;
  saleName: string;
  message: string;
};

export type LineGroup = {
  groupId: string;
  type: string;
  name: string;
  lastSeenAt: string;
};

export type LineWebhookLog = {
  receivedAt: string;
  signatureValid: string;
  eventCount: string;
  source: string;
  error: string;
};
