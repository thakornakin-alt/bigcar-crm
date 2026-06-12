export type Customer = {
  no: string;
  date: string;
  car: string;
  name: string;
  phone: string;
  note: string;
  ownerId?: string;
  ownerName?: string;
  rowIndex: number;
};

export type CustomerInput = {
  car: string;
  name: string;
  phone: string;
  note: string;
  ownerId?: string;
  ownerName?: string;
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
  engineNo: string;
  chassisNo: string;
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
  reportReturnDate?: string;
  agingGroup?: string;
  aging?: string;
  customerName?: string;
  colorGroup?: string;
  closedSales?: string;
  inspection?: string;
  extendedWarranty?: string;
  sellerName?: string;
  bookingSaleDate?: string;
  pdiStatus?: string;
  engineNo?: string;
  financeName?: string;
  extraFields?: Record<string, string>;
  vin?: string;
  finalGrade?: string;
  program?: string;
  parkingLocation?: string;
  status?: string;
  gear?: string;
  mileage?: string;
  pdiNote?: string;
  vehicleGroup?: string;
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
  clientEngineNoRows?: number;
  clientStatusRows?: number;
  clientVehicleGroupRows?: number;
  clientPdiNoteRows?: number;
  vinReceived?: number;
  vinWritten?: number;
  engineNoReceived?: number;
  engineNoWritten?: number;
  pdiReceived?: number;
  pdiWritten?: number;
};

export type StockImportStatus = {
  total: number;
  latestImportedAt: string;
  latestUpdatedAt: string;
};

export type SalesUserRole = "super_admin" | "admin" | "sales" | "viewer";

export type SalesUser = {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  lineId: string;
  lineQrUrl: string;
  avatarUrl: string;
  position: string;
  branch: string;
  role: SalesUserRole;
  locked: boolean;
};

export type SalesUserRegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  lineId: string;
  lineQrUrl?: string;
  avatarUrl?: string;
  position?: string;
  branch: string;
};

export type SalesUserLoginInput = {
  email: string;
  password: string;
};

export type ActivityLogInput = {
  userId?: string;
  userName?: string;
  role?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
};

export type ActivityLog = Required<ActivityLogInput> & {
  at: string;
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

export type ProfileImageKind = "avatar" | "lineQr";

export type ProfileImageUploadInput = {
  userId: string;
  kind: ProfileImageKind;
  file: DriveUploadFile;
};

export type ProfileImageUploadResult = {
  name: string;
  type: string;
  size: number;
  url: string;
  fileId: string;
  folderUrl: string;
  uploadedAt: string;
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
  address?: string;
  phone: string;
  idCard: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  engineNo?: string;
  chassisNo?: string;
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

export type BookingDeliveryStatus =
  | "ยอดจอง"
  | "รอผลไฟแนนซ์"
  | "รอส่งมอบ"
  | "ยอดส่งมอบ"
  | "ยกเลิก";

export type BookingDeliveryRecord = {
  id: string;
  bookingId: string;
  bookingReportId: string;
  salesReportId: string;
  plate: string;
  customerName: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  engineNo: string;
  chassisNo: string;
  saleName: string;
  teamName: string;
  teamId: string;
  ownerForCommission?: string;
  commissionGrade?: "G1" | "G2" | "G3" | "";
  countForCommission?: boolean;
  commissionVersion?: string;
  commissionNote?: string;
  source: string;
  ownership: string;
  project: string;
  campaign: string;
  bookingPrice: string;
  salePrice: string;
  finalPrice: string;
  centralDiscount: string;
  bookingDeduction: string;
  downPayment: string;
  netPayment: string;
  paymentType: string;
  deliveryDate: string;
  deliveryCompletedDate?: string;
  deliveryLocation: string;
  garageOutDate: string;
  garageReturnDate: string;
  spaFullSystemDone: boolean;
  oilChangeDone: boolean;
  decalRemovalDone: boolean;
  vehicleInspectionDone?: boolean;
  insuranceDone: boolean;
  insuranceStatus?: string;
  deliveryNote?: string;
  workflowStatus: BookingDeliveryStatus | "";
  financeCaseSubmitted: boolean;
  financeCaseSubmittedAt: string;
  financeCaseNote: string;
  financeAttachmentIds: string[];
  status: BookingDeliveryStatus;
  statusSource: "auto" | "manual";
  summary: string;
  alertSummary: string;
  cancelReason: string;
  createdAt: string;
  updatedAt: string;
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
  engineNo?: string;
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
