import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRow = { store_key: string; data: { records?: Array<Record<string, unknown>> }; updated_at: string };

const STORE_KEY = "booking-delivery.json";
const REASON = "Confirmed QA/Test record";
const APPROVED = new Map([
  ["BR-20260723-222801-836", "PD834CE25-2301"],
  ["BR-20260723-221340-190", "PV834CE25-2301"],
  ["BR-20260717-111602-791", "TESTPV-MASTER-E5F384B-1"],
  ["BR-20260723-213741-657", "TESTPV-A1FC7C4-VALID1"],
  ["BR-20260723-205404-178", "TESTV2-20260723-205400"]
]);
const CONTROLS = new Set(["BR-20260523-152951-586", "BR-20260616-182701-822"]);

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const table = String(process.env.SUPABASE_CRM_STORE_TABLE || "big_car_crm_store");
  if (!url || !key) throw new Error("Supabase configuration unavailable");
  return { url, key, table };
}

function authorized(request: Request) {
  const expected = Buffer.from(String(process.env.PHASE24_QA_WRITE_TOKEN || "").trim());
  const actual = Buffer.from(String(request.headers.get("x-phase24-token") || "").trim());
  return expected.length >= 32 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function storeRequest<T>(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Store request failed (${response.status})`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function readStore() {
  const { table } = config();
  const rows = await storeRequest<StoreRow[]>(`${table}?store_key=eq.${STORE_KEY}&select=store_key,data,updated_at&limit=1`);
  if (rows.length !== 1) throw new Error(`Expected exactly one ${STORE_KEY} row; found ${rows.length}`);
  return rows[0];
}

function validate(row: StoreRow) {
  const records = Array.isArray(row.data?.records) ? row.data.records : [];
  const checks = [...APPROVED].map(([id, expectedPlate]) => {
    const matches = records.filter((record) => record.id === id);
    return { id, expectedPlate, actualPlate: matches.length === 1 ? String(matches[0].plate || "") : "", count: matches.length, pass: matches.length === 1 && matches[0].plate === expectedPlate };
  });
  if (checks.some((check) => !check.pass)) throw new Error(`Precondition failed: ${JSON.stringify(checks)}`);
  return { records, checks };
}

function metadata(record: Record<string, unknown>) {
  return {
    qaTestRecord: record.qaTestRecord,
    excludeFromMetrics: record.excludeFromMetrics,
    archiveReason: record.archiveReason,
    archivedAt: record.archivedAt
  };
}

async function compareAndSwap(row: StoreRow, records: Array<Record<string, unknown>>) {
  const { table } = config();
  const nextUpdatedAt = new Date().toISOString();
  const changed = await storeRequest<StoreRow[]>(
    `${table}?store_key=eq.${STORE_KEY}&updated_at=eq.${encodeURIComponent(row.updated_at)}&select=store_key,updated_at`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ data: { ...row.data, records }, updated_at: nextUpdatedAt })
    }
  );
  if (!Array.isArray(changed) || changed.length !== 1) throw new Error("Concurrent store change detected; no metadata write applied");
  return changed[0].updated_at;
}

export async function POST(request: Request) {
  try {
    if (process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "Preview only" }, { status: 403 });
    if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "dryRun");
    const row = await readStore();
    if (body.expectedStoreUpdatedAt && body.expectedStoreUpdatedAt !== row.updated_at) throw new Error("Store changed since preflight; no write applied");
    const { records, checks } = validate(row);
    const approvedBefore = records.filter((record) => APPROVED.has(String(record.id || "")));
    const controlsBefore = records.filter((record) => CONTROLS.has(String(record.id || "")));
    const preQaCount = records.filter((record) => record.qaTestRecord === true).length;

    if (action === "dryRun") {
      return NextResponse.json({ ok: true, action, storeUpdatedAt: row.updated_at, totalRecords: records.length, preQaCount, checks, approvedRecords: approvedBefore, controlRecords: controlsBefore });
    }

    let nextRecords: Array<Record<string, unknown>>;
    if (action === "apply") {
      nextRecords = records.map((record) => APPROVED.has(String(record.id || ""))
        ? { ...record, qaTestRecord: true, excludeFromMetrics: true, archiveReason: REASON }
        : record);
    } else if (action === "rollback") {
      const rollback = body.rollbackMetadata && typeof body.rollbackMetadata === "object" ? body.rollbackMetadata as Record<string, Record<string, unknown>> : {};
      if ([...APPROVED.keys()].some((id) => !Object.prototype.hasOwnProperty.call(rollback, id))) throw new Error("Incomplete rollback metadata");
      nextRecords = records.map((record) => {
        const id = String(record.id || "");
        if (!APPROVED.has(id)) return record;
        const original = rollback[id] || {};
        const next = { ...record };
        for (const field of ["qaTestRecord", "excludeFromMetrics", "archiveReason", "archivedAt"] as const) {
          if (original[field] === undefined) delete next[field]; else next[field] = original[field];
        }
        return next;
      });
    } else {
      throw new Error("Unsupported action");
    }

    const updatedAt = await compareAndSwap(row, nextRecords);
    const verified = await readStore();
    const { records: verifiedRecords } = validate(verified);
    const approvedAfter = verifiedRecords.filter((record) => APPROVED.has(String(record.id || "")));
    const controlsAfter = verifiedRecords.filter((record) => CONTROLS.has(String(record.id || "")));
    return NextResponse.json({
      ok: true,
      action,
      previousStoreUpdatedAt: row.updated_at,
      storeUpdatedAt: updatedAt,
      preQaCount,
      postQaCount: verifiedRecords.filter((record) => record.qaTestRecord === true).length,
      approved: approvedAfter.map((record) => ({ id: record.id, plate: record.plate, metadata: metadata(record) })),
      controlsUnchanged: JSON.stringify(controlsBefore) === JSON.stringify(controlsAfter)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Phase 2.4 operation failed" }, { status: 409 });
  }
}
