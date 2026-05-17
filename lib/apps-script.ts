import type { Customer, CustomerInput } from "@/lib/types";

type AppsScriptAction = "list" | "add" | "update" | "delete";

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
