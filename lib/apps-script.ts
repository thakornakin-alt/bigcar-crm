import type {
  ActivityLog,
  ActivityLogInput,
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
  ProfileImageUploadInput,
  ProfileImageUploadResult,
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
  | "resetUserData"
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
  | "updateSalesUser"
  | "uploadProfileImage"
  | "saveActivityLog"
  | "listActivityLogs";

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

function normalizePlateLookup(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

async function callAppsScriptDetailed<T>(action: AppsScriptAction, payload: Record<string, unknown> = {}) {
  const endpoint = getAppsScriptUrl();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ action, ...payload }),
      cache: "no-store"
    });
    const text = await response.text();
    let data: AppsScriptResponse<T> | null = null;
    try {
      data = JSON.parse(text) as AppsScriptResponse<T>;
    } catch {
      return {
        ok: false as const,
        endpointUsed: endpoint,
        appsScriptUrlConfigured: true,
        fetchStatus: response.status,
        fetchStatusText: response.statusText,
        errorMessage: "Apps Script returned an invalid JSON response",
        responseText: text
      };
    }
    return {
      ok: response.ok && !!data && data.ok === true,
      endpointUsed: endpoint,
      appsScriptUrlConfigured: true,
      fetchStatus: response.status,
      fetchStatusText: response.statusText,
      data,
      responseText: text
    } as const;
  } catch (error) {
    return {
      ok: false as const,
      endpointUsed: endpoint,
      appsScriptUrlConfigured: true,
      fetchStatus: null as number | null,
      fetchStatusText: "",
      errorMessage: error instanceof Error ? error.message : "Apps Script fetch failed"
    };
  }
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
  if (data.vehicle) return data.vehicle;

  const normalizedPlate = normalizePlateLookup(plate);
  if (!normalizedPlate) return null;

  const listed = await listStockVehicles({ query: plate, limit: 1000 }).catch(() => ({ vehicles: [] as StockVehicle[], total: 0 }));
  const exact = (listed.vehicles || []).find((vehicle) => normalizePlateLookup(vehicle.plate) === normalizedPlate) || null;
  return exact;
}

export async function lookupStockByPlateDetailed(plate: string) {
  const endpointUsed = process.env.GOOGLE_APPS_SCRIPT_URL || "";
  const appsScriptUrlConfigured = Boolean(endpointUsed);

  if (!appsScriptUrlConfigured) {
    return {
      vehicle: null as StockVehicle | null,
      warning: "Missing environment variable: GOOGLE_APPS_SCRIPT_URL",
      debug: {
        appsScriptUrlConfigured: false,
        endpointUsed,
        fetchStatus: null as number | null,
        fetchStatusText: "",
        errorMessage: "Missing environment variable: GOOGLE_APPS_SCRIPT_URL",
        fallbackUsed: false
      }
    };
  }

  const primary = await callAppsScriptDetailed<{ vehicle: StockVehicle | null }>("lookupStockByPlate", { plate });
  if (primary.ok && primary.data && "vehicle" in primary.data && primary.data.vehicle) {
    return {
      vehicle: primary.data.vehicle,
      debug: {
        appsScriptUrlConfigured,
        endpointUsed: primary.endpointUsed,
        fetchStatus: primary.fetchStatus,
        fetchStatusText: primary.fetchStatusText,
        errorMessage: "",
        fallbackUsed: false
      }
    };
  }

  const primaryError =
    !primary.ok
      ? primary.errorMessage || "Apps Script request failed"
      : "No vehicle returned from Apps Script";

  const normalizedPlate = normalizePlateLookup(plate);
  let fallbackUsed = false;
  let fallbackError = "";
  try {
    const listed = await listStockVehicles({ query: plate, limit: 1000 });
    fallbackUsed = true;
    const exact = (listed.vehicles || []).find((vehicle) => normalizePlateLookup(vehicle.plate) === normalizedPlate) || null;
    if (exact) {
      return {
        vehicle: exact,
        debug: {
          appsScriptUrlConfigured,
          endpointUsed: primary.endpointUsed,
          fetchStatus: primary.fetchStatus,
          fetchStatusText: primary.fetchStatusText,
          errorMessage: "",
          fallbackUsed: true
        }
      };
    }
  } catch (error) {
    fallbackError = error instanceof Error ? error.message : "Apps Script fallback lookup failed";
  }

  return {
    vehicle: null as StockVehicle | null,
    warning: fallbackError || primaryError,
    debug: {
      appsScriptUrlConfigured,
      endpointUsed: primary.endpointUsed,
      fetchStatus: primary.fetchStatus,
      fetchStatusText: primary.fetchStatusText,
      errorMessage: fallbackError || primaryError,
      fallbackUsed
    }
  };
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

export async function resetUserData(input: { keepMonth?: string } = {}) {
  const data = await callAppsScript<{ result: { keepMonth: string; summaries: { sheet: string; deleted: number }[] } }>("resetUserData", input);
  return data.result;
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
  lineQrUrl?: string;
  avatarUrl?: string;
  position?: string;
  branch?: string;
}) {
  const data = await callAppsScript<{ user: SalesUser }>("updateSalesUser", { user: input });
  return data.user;
}

export async function uploadProfileImage(input: ProfileImageUploadInput) {
  const data = await callAppsScript<{ result: ProfileImageUploadResult }>("uploadProfileImage", input);
  return data.result;
}

export async function saveActivityLog(input: ActivityLogInput) {
  const data = await callAppsScript<{ saved: boolean }>("saveActivityLog", { log: input });
  return data.saved;
}

export async function listActivityLogs(limit = 100) {
  const data = await callAppsScript<{ logs: ActivityLog[] }>("listActivityLogs", { limit });
  return data.logs;
}
