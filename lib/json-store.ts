import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type SupabaseStoreRow = {
  store_key: string;
  data: unknown;
  updated_at?: string;
};

type JsonStoreTiming = {
  provider: string;
  readMs: number;
};

const SUPABASE_READ_TIMEOUT_MS = 9000;

let lastJsonStoreTiming: JsonStoreTiming = {
  provider: String(process.env.BIG_CAR_STORE_PROVIDER || "json").trim().toLowerCase(),
  readMs: 0
};

function storeProvider() {
  return String(process.env.DATA_PROVIDER || process.env.BIG_CAR_STORE_PROVIDER || "json").trim().toLowerCase();
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_URL) || Boolean(process.env.VERCEL_ENV);
}

function timingLog(step: string, data: Record<string, unknown>) {
  console.info(`[json-store-timing] ${step}`, data);
}

export function getLastJsonStoreTiming() {
  return { ...lastJsonStoreTiming };
}

let warnedTempStorage = false;

export function dataDirectory() {
  if (process.env.BIG_CAR_DATA_DIR) {
    return path.resolve(process.env.BIG_CAR_DATA_DIR);
  }

  if (isVercelRuntime() && storeProvider() !== "supabase") {
    const tempDir = path.join("/tmp", "bigcar-crm-data");
    if (!warnedTempStorage) {
      warnedTempStorage = true;
      console.warn("[json-store] using temporary storage directory", { dataDir: tempDir, provider: storeProvider() });
    }
    return tempDir;
  }

  return path.join(process.cwd(), ".data");
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

async function supabaseRequest<T>(
  pathName: string,
  init: RequestInit = {},
  timeoutMs = SUPABASE_READ_TIMEOUT_MS
): Promise<T> {
  const { url, serviceRoleKey } = supabaseConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Supabase store request timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    const response = await fetch(`${url}/rest/v1/${pathName}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers || {})
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Supabase store request failed: ${response.status} ${detail}`);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    if (!text.trim()) return undefined as T;

    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function readSupabaseStore<T>(fileName: string, fallback: T): Promise<T> {
  const { table } = supabaseConfig();
  const key = encodeURIComponent(fileName);
  const supabaseStart = Date.now();
  timingLog("readJsonStore supabase fetch start", { fileName, table });
  const rows = await supabaseRequest<SupabaseStoreRow[]>(
    `${table}?store_key=eq.${key}&select=store_key,data&limit=1`
  );
  timingLog("readJsonStore supabase fetch end", {
    fileName,
    table,
    ms: Date.now() - supabaseStart,
    rows: Array.isArray(rows) ? rows.length : 0
  });
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
  const start = Date.now();
  const provider = storeProvider();
  lastJsonStoreTiming = { provider, readMs: 0 };
  timingLog("readJsonStore start", { fileName, provider });
  try {
    if (provider === "supabase") {
      const result = await readSupabaseStore(fileName, fallback);
      const readMs = Date.now() - start;
      lastJsonStoreTiming = { provider, readMs };
      timingLog("readJsonStore complete", { fileName, provider, ms: readMs });
      return result;
    }

    const readStart = Date.now();
    timingLog("readJsonStore file read start", { fileName, provider });
    const raw = await readFile(storePath(fileName), "utf8");
    timingLog("readJsonStore file read end", { fileName, provider, ms: Date.now() - readStart, bytes: Buffer.byteLength(raw, "utf8") });
    const parsed = JSON.parse(raw) as T;
    const readMs = Date.now() - start;
    lastJsonStoreTiming = { provider, readMs };
    timingLog("readJsonStore complete", { fileName, provider, ms: readMs });
    return parsed;
  } catch (error) {
    const readMs = Date.now() - start;
    lastJsonStoreTiming = { provider, readMs };
    timingLog("readJsonStore error", {
      fileName,
      provider,
      ms: readMs,
      error: error instanceof Error ? error.message : "unknown"
    });
    if (provider !== "supabase") {
      timingLog("readJsonStore fallback", { fileName, provider, ms: readMs });
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonStore<T>(fileName: string, data: T) {
  if (storeProvider() === "supabase") {
    await writeSupabaseStore(fileName, data);
    return;
  }

  const dir = dataDirectory();
  await mkdir(dir, { recursive: true });
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
