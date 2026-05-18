import type {
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
  SalesReport,
  SalesReportInput,
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
  | "lookupCustomerById"
  | "importStock"
  | "getStockImportStatus"
  | "searchBookingReports"
  | "saveSalesReport"
  | "uploadDriveFiles"
  | "createSalesEmailDraft"
  | "createBookingEmailDraft";

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
