import type {
  ApprovalBooking,
  ApprovalLogInput,
  ApprovalStaff,
  ApprovalStockVehicle,
  BookingReport,
  BookingReportInput,
  Customer,
  CustomerInput,
  CustomerLookup,
  DriveUploadInput,
  DriveUploadResult,
  EmailDraftInput,
  EmailDraftResult,
  InterestRate,
  LineGroup,
  LineWebhookLog,
  ReportHistoryItem,
  SalesReport,
  SalesReportInput,
  SalesUser,
  SalesUserLoginInput,
  SalesUserRegisterInput,
  StockImportInput,
  StockImportResult,
  StockImportStatus,
  StockVehicle
} from "@/lib/types";

type AppsScriptAction =
  | "list"
  | "add"
  | "update"
  | "delete"
  | "listInterestRates"
  | "saveBookingReport"
  | "lookupStockByPlate"
  | "listStockVehicles"
  | "lookupCustomerById"
  | "importStock"
  | "getStockImportStatus"
  | "listReportHistory"
  | "updateReportStatus"
  | "searchBookingReports"
  | "saveSalesReport"
  | "uploadDriveFiles"
  | "createSalesEmailDraft"
  | "createBookingEmailDraft"
  | "getStaffList"
  | "lookupByPlate"
  | "lookupBookingByPlate"
  | "saveApprovalLog"
  | "saveLineGroup"
  | "listLineGroups"
  | "saveLineWebhookLog"
  | "listLineWebhookLogs"
  | "registerSalesUser"
  | "loginSalesUser"
  | "listSalesUsers"
  | "updateSalesUser";

type AppsScriptResponse<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error?: string;
    };

function getAppsScriptUrl() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) {
    throw new Error("Missing environment variable: GOOGLE_APPS_SCRIPT_URL");
  }
  return url;
}

async function callAppsScript<T>(action: AppsScriptAction, payload: Record<string, unknown> = {}) {
  const response = await fetch(getAppsScriptUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store"
  });

  const text = await response.text();
  let data: AppsScriptResponse<T>;

  try {
    data = JSON.parse(text) as AppsScriptResponse<T>;
  } catch {
    throw new Error("Apps Script returned an invalid JSON response");
  }

  if (!response.ok) {
    throw new Error("Apps Script request failed");
  }

  if (data.ok !== true) {
    throw new Error(data.error || "Apps Script request failed");
  }

  return data;
}

export async function listCustomers() {
  const data = await callAppsScript<{ customers: Customer[] }>("list");
  return data.customers;
}

export async function addCustomer(input: CustomerInput) {
  const data = await callAppsScript<{ customer: Customer }>("add", { customer: input });
  return data.customer;
}

export async function updateCustomer(rowIndex: number, input: CustomerInput) {
  const data = await callAppsScript<{ customer: Customer }>("update", { rowIndex, customer: input });
  return data.customer;
}

export async function deleteCustomer(rowIndex: number) {
  await callAppsScript<{ ok: true }>("delete", { rowIndex });
  return { ok: true };
}

export async function listInterestRates() {
  const data = await callAppsScript<{ rates: InterestRate[] }>("listInterestRates");
  return data.rates;
}

export async function saveBookingReport(input: BookingReportInput) {
  const data = await callAppsScript<{ report: BookingReport }>("saveBookingReport", { report: input });
  return data.report;
}

export async function lookupStockByPlate(plate: string) {
  const data = await callAppsScript<{ vehicle: StockVehicle | null }>("lookupStockByPlate", { plate });
  return data.vehicle;
}

export async function listStockVehicles(input: { query?: string; limit?: number } = {}) {
  const data = await callAppsScript<{ vehicles: StockVehicle[]; total: number }>("listStockVehicles", input);
  return data;
}

export async function lookupCustomerById(idCard: string) {
  const data = await callAppsScript<{ customer: CustomerLookup }>("lookupCustomerById", { idCard });
  return data.customer;
}

export async function importStock(input: StockImportInput) {
  const data = await callAppsScript<{ result: StockImportResult }>("importStock", input);
  return data.result;
}

export async function getStockImportStatus() {
  const data = await callAppsScript<{ status: StockImportStatus }>("getStockImportStatus");
  return data.status;
}

export async function listReportHistory(query: string, type: string) {
  const data = await callAppsScript<{ reports: ReportHistoryItem[] }>("listReportHistory", { query, type });
  return data.reports;
}

export async function updateReportStatus(input: { id: string; type: string; status: string }) {
  const data = await callAppsScript<{ report: ReportHistoryItem }>("updateReportStatus", input);
  return data.report;
}

export async function searchBookingReports(query: string) {
  const data = await callAppsScript<{ reports: BookingReport[] }>("searchBookingReports", { query });
  return data.reports;
}

export async function saveSalesReport(input: SalesReportInput) {
  const data = await callAppsScript<{ report: SalesReport }>("saveSalesReport", { report: input });
  return data.report;
}

export async function uploadDriveFiles(input: DriveUploadInput) {
  const data = await callAppsScript<{ result: DriveUploadResult }>("uploadDriveFiles", input);
  return data.result;
}

export async function createSalesEmailDraft(input: EmailDraftInput) {
  const data = await callAppsScript<{ result: EmailDraftResult }>("createSalesEmailDraft", input);
  return data.result;
}

export async function createBookingEmailDraft(input: EmailDraftInput) {
  const data = await callAppsScript<{ result: EmailDraftResult }>("createBookingEmailDraft", input);
  return data.result;
}

export async function getStaffList() {
  const data = await callAppsScript<{ staff: ApprovalStaff[] }>("getStaffList");
  return data.staff;
}

export async function lookupApprovalStockByPlate(plate: string) {
  const data = await callAppsScript<{ vehicle: ApprovalStockVehicle | null }>("lookupByPlate", { plate });
  return data.vehicle;
}

export async function lookupApprovalBookingByPlate(plate: string) {
  const data = await callAppsScript<{ booking: ApprovalBooking }>("lookupBookingByPlate", { plate });
  return data.booking;
}

export async function saveApprovalLog(input: ApprovalLogInput) {
  const data = await callAppsScript<{ saved: boolean; timestamp: string }>("saveApprovalLog", input);
  return data;
}

export async function saveLineGroup(input: LineGroup) {
  const data = await callAppsScript<{ group: LineGroup }>("saveLineGroup", input);
  return data.group;
}

export async function listLineGroups() {
  const data = await callAppsScript<{ groups: LineGroup[] }>("listLineGroups");
  return data.groups;
}

export async function saveLineWebhookLog(input: LineWebhookLog) {
  const data = await callAppsScript<{ saved: boolean }>("saveLineWebhookLog", input);
  return data.saved;
}

export async function listLineWebhookLogs() {
  const data = await callAppsScript<{ logs: LineWebhookLog[] }>("listLineWebhookLogs");
  return data.logs;
}

export async function registerSalesUser(input: SalesUserRegisterInput) {
  const data = await callAppsScript<{ user: SalesUser }>("registerSalesUser", { user: input });
  return data.user;
}

export async function loginSalesUser(input: SalesUserLoginInput) {
  const data = await callAppsScript<{ user: SalesUser }>("loginSalesUser", input);
  return data.user;
}

export async function listSalesUsers() {
  const data = await callAppsScript<{ users: SalesUser[] }>("listSalesUsers");
  return data.users;
}

export async function updateSalesUser(input: {
  id: string;
  role?: SalesUser["role"];
  locked?: boolean;
  phone?: string;
  lineId?: string;
  position?: string;
  branch?: string;
}) {
  const data = await callAppsScript<{ user: SalesUser }>("updateSalesUser", { user: input });
  return data.user;
}
