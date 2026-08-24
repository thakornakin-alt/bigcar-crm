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
import type { CommissionGroupLookupInput, CommissionGroupLookupResult } from "@/lib/commission-canonical-capture";
import { createHmac, randomBytes } from "node:crypto";

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
  | "checkSalesReportDuplicate"
  | "resetUserData"
  | "uploadDriveFiles"
  | "createSalesEmailDraft"
  | "createBookingEmailDraft"
  | "getStaffList"
  | "lookupByPlate"
  | "lookupBookingByPlate"
  | "lookupBookingListCommissionGroup"
  | "saveApprovalLog"
  | "saveLineGroup"
  | "listLineGroups"
  | "saveLineWebhookLog"
  | "listLineWebhookLogs"
  | "registerSalesUser"
  | "loginSalesUser"
  | "listSalesUsers"
  | "updateSalesUser"
  | "sendPasswordResetEmail"
  | "uploadProfileImage"
  | "saveActivityLog"
  | "listActivityLogs";

type AppsScriptResponse<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error?: string;
    };

const SIGNED_APPS_SCRIPT_ACTIONS = new Set<AppsScriptAction>([
  "loginSalesUser",
  "registerSalesUser",
  "listSalesUsers",
  "updateSalesUser",
  "sendPasswordResetEmail"
]);

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppsScriptError("configuration_error", "Non-finite signed payload value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new AppsScriptError("configuration_error", "Unsupported signed payload value");
}

function signedAppsScriptBody(action: AppsScriptAction, payload: Record<string, unknown>) {
  if (!SIGNED_APPS_SCRIPT_ACTIONS.has(action)) return { action, ...payload };
  const secret = process.env.BIGCAR_APPS_SCRIPT_AUTH_SECRET;
  if (!secret) throw new AppsScriptError("configuration_error", "Missing Apps Script application-boundary secret");
  const timestamp = String(Date.now());
  const nonce = randomBytes(24).toString("hex");
  const canonicalPayload = canonicalJson(payload);
  const canonical = [action, timestamp, nonce, canonicalPayload].join("\n");
  const signature = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
  return { action, payload, envelope: { timestamp, nonce, signature } };
}

export type AppsScriptErrorCode =
  | "timeout"
  | "network_error"
  | "upstream_http_error"
  | "invalid_response"
  | "configuration_error"
  | "apps_script_action_missing"
  | "unknown_error";

export class AppsScriptError extends Error {
  readonly code: AppsScriptErrorCode;
  readonly status?: number;

  constructor(
    code: AppsScriptErrorCode,
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "AppsScriptError";
    this.code = code;
    this.status = status;
  }
}

function getAppsScriptUrl() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) {
    throw new AppsScriptError("configuration_error", "Missing environment variable: GOOGLE_APPS_SCRIPT_URL");
  }
  return url;
}

function normalizePlateLookup(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function appsScriptConnectionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = (error as { code?: string } | null)?.code || "";
  if (
    message.toLowerCase().includes("fetch failed") ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("abort") ||
    message.toLowerCase().includes("eacces") ||
    message.toLowerCase().includes("econnrefused") ||
    message.toLowerCase().includes("enotfound") ||
    code === "EACCES" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ABORT_ERR"
  ) {
    return "ไม่สามารถเชื่อมต่อ Google Apps Script ได้ กรุณาตรวจ Network/Firewall/Internet/Runtime";
  }
  return message || "Apps Script fetch failed";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const code = (error as { code?: string } | null)?.code || "";
    const timedOut = controller.signal.aborted || error instanceof DOMException && error.name === "AbortError" || /abort|timeout/i.test(message) || code === "ETIMEDOUT" || code === "ABORT_ERR";
    throw new AppsScriptError(timedOut ? "timeout" : "network_error", appsScriptConnectionErrorMessage(error));
  } finally {
    clearTimeout(timer);
  }
}

async function callAppsScriptDetailed<T>(action: AppsScriptAction, payload: Record<string, unknown> = {}) {
  const endpoint = getAppsScriptUrl();
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(signedAppsScriptBody(action, payload)),
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
  const response = await fetchWithTimeout(getAppsScriptUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(signedAppsScriptBody(action, payload)),
    cache: "no-store"
  });

  const text = await response.text();
  let data: AppsScriptResponse<T>;

  try {
    data = JSON.parse(text) as AppsScriptResponse<T>;
  } catch {
    throw new AppsScriptError("invalid_response", "Apps Script returned an invalid JSON response");
  }

  if (!response.ok) {
    throw new AppsScriptError("upstream_http_error", "Apps Script request failed", response.status);
  }

  if (data.ok !== true) {
    const message = data.error || "Apps Script request failed";
    const actionMissing = /unknown action|action.*(?:missing|not found|unsupported)|ไม่รู้จัก.*action/i.test(message);
    throw new AppsScriptError(actionMissing ? "apps_script_action_missing" : "unknown_error", message);
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

export async function checkBookingReportDuplicate(input: BookingReportInput, actorId: string) {
  const data = await callAppsScript<{ report: import("@/lib/booking-report-duplicate").BookingDuplicateCheck }>(
    "saveBookingReport",
    { report: { ...input, _checkOnly: true, _actorId: actorId } }
  );
  return data.report;
}

export async function saveBookingReport(
  input: BookingReportInput,
  options: { requestId: string; confirmationToken?: string; actorId: string }
) {
  const data = await callAppsScript<{ report: BookingReport }>("saveBookingReport", {
    report: {
      ...input,
      _requestId: options.requestId,
      _confirmationToken: options.confirmationToken || "",
      _actorId: options.actorId
    }
  });
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

export async function listReportHistory(query: string, type: string, options: { includeExcluded?: boolean } = {}) {
  const data = await callAppsScript<{ reports: ReportHistoryItem[] }>("listReportHistory", { query, type });
  const { applySalesReportQaPolicy } = await import("@/lib/sales-report-qa-metadata");
  return applySalesReportQaPolicy(data.reports, options);
}

export async function updateReportStatus(input: { id: string; type: string; status: string }) {
  const data = await callAppsScript<{ report: ReportHistoryItem }>("updateReportStatus", input);
  return data.report;
}

export async function searchBookingReports(query: string) {
  const data = await callAppsScript<{ reports: BookingReport[] }>("searchBookingReports", { query });
  return data.reports;
}

export async function checkSalesReportDuplicate(input: SalesReportInput, actorId: string) {
  const data = await callAppsScript<{ result: import("@/lib/sales-report-duplicate").SalesDuplicateCheck }>("checkSalesReportDuplicate", { report: input, actorId });
  return data.result;
}

export async function saveSalesReport(input: SalesReportInput, options: { requestId: string; confirmationToken?: string; actorId: string }) {
  const data = await callAppsScript<{ report: SalesReport }>("saveSalesReport", {
    report: {
      ...input,
      _requestId: options.requestId,
      _confirmationToken: options.confirmationToken || "",
      _actorId: options.actorId
    }
  });
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

export async function lookupBookingListCommissionGroup(input: CommissionGroupLookupInput) {
  const data = await callAppsScript<{ result: CommissionGroupLookupResult }>("lookupBookingListCommissionGroup", { input });
  return data.result;
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
  firstName?: string;
  lastName?: string;
  nickname?: string;
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

export type PasswordResetEmailInput = {
  recipientEmail: string;
  resetUrl: string;
  displayName?: string;
  requestId: string;
};

export type PasswordResetEmailResult = {
  status: "sent" | "retryable_failure" | "permanent_failure" | "duplicate_request";
};

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const data = await callAppsScript<{ result: PasswordResetEmailResult }>("sendPasswordResetEmail", input);
  return data.result;
}

export async function verifyPasswordResetEmailSenderBoundary(previewOrigin: string) {
  type BoundaryEnvelope = {
    action: AppsScriptAction;
    payload: Record<string, unknown>;
    envelope: { timestamp: string; nonce: string; signature: string };
  };
  const postBoundaryFixture = async (body: BoundaryEnvelope) => {
    const response = await fetchWithTimeout(getAppsScriptUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const data = JSON.parse(await response.text()) as AppsScriptResponse<{ users?: SalesUser[] }>;
    return { ok: response.ok && data.ok === true, error: data.ok === false ? data.error || "unknown_error" : undefined };
  };
  const capture = async (input: PasswordResetEmailInput) => {
    try {
      await sendPasswordResetEmail(input);
      return "unexpected_send";
    } catch (error) {
      return error instanceof Error ? error.message : "unknown_error";
    }
  };
  const token = "a".repeat(43);
  const users = await listSalesUsers();
  const replayBody = signedAppsScriptBody("listSalesUsers", {}) as BoundaryEnvelope;
  const replayFirst = await postBoundaryFixture(replayBody);
  const replaySecond = await postBoundaryFixture(replayBody);
  const invalidSignatureBody = signedAppsScriptBody("listSalesUsers", {}) as BoundaryEnvelope;
  invalidSignatureBody.envelope.signature = "0".repeat(64);
  const invalidSignature = await postBoundaryFixture(invalidSignatureBody);
  return {
    signedListSalesUsers: { ok: Array.isArray(users) },
    replay: { firstAccepted: replayFirst.ok, secondError: replaySecond.error },
    invalidSignature: invalidSignature.error,
    signedFixture: await capture({
      recipientEmail: "invalid",
      resetUrl: `${previewOrigin}/reset-password?token=${token}`,
      requestId: "runtime-v63-fixture-invalid-recipient"
    }),
    invalidUrl: await capture({
      recipientEmail: "qa@example.invalid",
      resetUrl: `https://invalid.example/reset-password?token=${token}`,
      requestId: "runtime-v63-invalid-url"
    }),
    productionUrl: await capture({
      recipientEmail: "qa@example.invalid",
      resetUrl: `https://bigcar-crm.vercel.app/reset-password?token=${token}`,
      requestId: "runtime-v63-production-url"
    })
  };
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
