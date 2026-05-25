import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type SupabaseStoreRow = {
  store_key: string;
  data: unknown;
  updated_at?: string;
};

function storeProvider() {
  return String(process.env.BIG_CAR_STORE_PROVIDER || "json").trim().toLowerCase();
}

function dataDirectory() {
  return process.env.BIG_CAR_DATA_DIR
    ? path.resolve(process.env.BIG_CAR_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function storePath(fileName: string) {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "-");
  return path.join(dataDirectory(), safeName);
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const table = String(process.env.SUPABASE_CRM_STORE_TABLE || "big_car_crm_store");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  return { url, serviceRoleKey, table };
}

async function supabaseRequest<T>(pathName: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${pathName}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase store request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readSupabaseStore<T>(fileName: string, fallback: T): Promise<T> {
  const { table } = supabaseConfig();
  const key = encodeURIComponent(fileName);
  const rows = await supabaseRequest<SupabaseStoreRow[]>(
    `${table}?store_key=eq.${key}&select=store_key,data&limit=1`
  );
  return rows[0]?.data === undefined ? fallback : rows[0].data as T;
}

async function writeSupabaseStore<T>(fileName: string, data: T) {
  const { table } = supabaseConfig();
  await supabaseRequest(
    `${table}?on_conflict=store_key`,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        store_key: fileName,
        data,
        updated_at: new Date().toISOString()
      })
    }
  );
}

export async function readJsonStore<T>(fileName: string, fallback: T): Promise<T> {
  if (storeProvider() === "supabase") {
    return readSupabaseStore(fileName, fallback);
  }

  try {
    const raw = await readFile(storePath(fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonStore<T>(fileName: string, data: T) {
  if (storeProvider() === "supabase") {
    await writeSupabaseStore(fileName, data);
    return;
  }

  await mkdir(dataDirectory(), { recursive: true });
  await writeFile(storePath(fileName), JSON.stringify(data, null, 2), "utf8");
}

export function jsonStoreInfo() {
  if (storeProvider() === "supabase") {
    return {
      provider: "supabase",
      table: process.env.SUPABASE_CRM_STORE_TABLE || "big_car_crm_store"
    };
  }

  return {
    provider: "json-file",
    dataDir: dataDirectory(),
    envKey: "BIG_CAR_DATA_DIR"
  };
}
