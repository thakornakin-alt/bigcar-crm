import { NextResponse } from "next/server";
import { listStockVehicles } from "@/lib/apps-script";
import type { StockVehicle } from "@/lib/types";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import { readStockWithBoundedRetry, StockReadFailure, stockReadUserMessage, classifyStockReadError, isRetryableStockReadError } from "@/lib/stock/stock-read-reliability";
import { getStockSnapshot, getStockSnapshotVersion, saveStockSnapshot, stockSnapshotIsCurrent } from "@/lib/stock/stock-snapshot";

export const dynamic = "force-dynamic";

const STOCK_LIST_MIN_COMPLETE_LIMIT = 1000;
const STOCK_LIST_MAX_LIMIT = 5000;

type StockListData = Awaited<ReturnType<typeof listStockVehicles>>;
type StockReadResult = Awaited<ReturnType<typeof readStockWithBoundedRetry<StockListData>>>;
const inFlightStockReads = new Map<string, Promise<StockReadResult>>();

function text(value: unknown) { return String(value ?? "").trim(); }
function pickValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) { const value = row[key]; if (value !== undefined && value !== null && text(value)) return text(value); }
  return "";
}
function normalizeStockVehicle(vehicle: StockVehicle) {
  const raw = vehicle as StockVehicle & Record<string, unknown>;
  return {
    ...vehicle,
    pdiNote: text(vehicle.pdiNote) || pickValue(raw, ["PdiNote", "PDINote", "pdi", "PDI", "pdi_note", "pdiRemark", "remark", "note", "หมายเหตุ PDI", "หมายเหตุPDI", "หมายเหตุ"]),
    engineNo: text(vehicle.engineNo) || pickValue(raw, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]),
    vehicleGroup: text(vehicle.vehicleGroup) || pickValue(raw, ["VehicleGroup", "vehicle_group", "กลุ่มรถยนต์", "กลุ่มรถ", "กลุ่ม"])
  };
}

async function readStockOncePerRequestKey(query: string, limit: number) {
  const key = `${query}\u0000${limit}`;
  const existing = inFlightStockReads.get(key);
  if (existing) { console.info("[stock-list-read] join-in-flight", { query: Boolean(query), effectiveLimit: limit }); return existing; }
  const pending = readStockWithBoundedRetry(() => listStockVehicles({ query, limit }));
  inFlightStockReads.set(key, pending);
  try { return await pending; }
  finally { if (inFlightStockReads.get(key) === pending) inFlightStockReads.delete(key); }
}

export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("query") || "").trim();
    const requestedLimit = Number(searchParams.get("limit"));
    const requestedOrDefault = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : STOCK_LIST_MIN_COMPLETE_LIMIT;
    const limit = Math.min(Math.max(requestedOrDefault, STOCK_LIST_MIN_COMPLETE_LIMIT), STOCK_LIST_MAX_LIMIT);
    const metaOnly = searchParams.get("meta") === "1";
    const forceRefresh = searchParams.get("refresh") === "1";
    // Stale full-stock fallback is intentionally disabled for filtered searches.\n    const allowStaleSnapshotFallback = !query;

    if (!query) {
      const [snapshot, marker] = await Promise.all([getStockSnapshot(), getStockSnapshotVersion()]);
      if (metaOnly) {
        return NextResponse.json({
          ok: true,
          version: marker.version !== "missing" ? marker.version : snapshot?.version || "missing",
          sourceName: marker.sourceName || snapshot?.sourceName || "",
          updatedAt: marker.updatedAt || snapshot?.updatedAt || "",
          snapshotReady: stockSnapshotIsCurrent(snapshot, marker)
        });
      }
      if (!forceRefresh && stockSnapshotIsCurrent(snapshot, marker) && snapshot) {
        return NextResponse.json({
          ok: true,
          vehicles: snapshot.vehicles,
          total: snapshot.total,
          version: snapshot.version,
          sourceName: snapshot.sourceName,
          snapshot: true,
          stale: false,
          meta: { durationMs: Date.now() - requestStartedAt, appsScriptDurationMs: 0, routeReadAttempts: 0, requestedLimit, effectiveLimit: limit, loaded: snapshot.vehicles.length, total: snapshot.total, complete: true }
        });
      }
    }

    const { value: data, meta } = await readStockOncePerRequestKey(query, limit);
    const vehicles = await mergeStockExtraFields(data.vehicles || []);
    const normalizedVehicles = vehicles.map(normalizeStockVehicle);
    const total = Number(data.total || 0);
    const completenessCheckApplies = !query && total > 0;
    const complete = !completenessCheckApplies || normalizedVehicles.length >= total;
    const durationMs = Date.now() - requestStartedAt;
    const readMeta = { durationMs, appsScriptDurationMs: meta.appsScriptDurationMs, routeReadAttempts: meta.routeReadAttempts };

    if (!complete) {
      console.error("[stock-list-read] incomplete", { ...readMeta, vehicleCount: normalizedVehicles.length, total, requestedLimit, effectiveLimit: limit });
      return NextResponse.json({
        ok: false,
        errorCode: "incomplete_stock_read",
        message: `ข้อมูลสต๊อกโหลดไม่ครบ ${normalizedVehicles.length.toLocaleString("th-TH")}/${total.toLocaleString("th-TH")} คัน ระบบหยุดการ Export เพื่อป้องกันรถตกหล่น กรุณาลองอัปเดตข้อมูลอีกครั้ง`,
        retryable: true,
        meta: { ...readMeta, requestedLimit, effectiveLimit: limit, loaded: normalizedVehicles.length, total }
      }, { status: 503 });
    }

    let snapshotInfo: { version?: string; sourceName?: string } = {};
    if (!query && complete) {
      const marker = await getStockSnapshotVersion();
      const saved = await saveStockSnapshot({
        vehicles: normalizedVehicles,
        total,
        version: marker.version !== "missing" ? marker.version : undefined,
        sourceName: marker.sourceName || "legacy-stock"
      });
      snapshotInfo = { version: saved.version, sourceName: saved.sourceName };
    }

    console.info("[stock-list-read] success", { ...readMeta, vehicleCount: normalizedVehicles.length, total, requestedLimit, effectiveLimit: limit, complete });
    return NextResponse.json({
      ...data,
      ...snapshotInfo,
      ok: true,
      snapshot: !query,
      stale: false,
      vehicles: normalizedVehicles,
      meta: { ...readMeta, requestedLimit, effectiveLimit: limit, loaded: normalizedVehicles.length, total, complete }
    });
  } catch (error) {
    const failure = error instanceof StockReadFailure ? error : null;
    const errorCode = failure?.code || classifyStockReadError(error);
    const retryable = failure?.retryable ?? isRetryableStockReadError(errorCode);
    const durationMs = Date.now() - requestStartedAt;
    const meta = failure?.meta || { routeReadAttempts: 1, attemptDurationsMs: [durationMs], appsScriptDurationMs: durationMs };
    const readMeta = { durationMs, appsScriptDurationMs: meta.appsScriptDurationMs, routeReadAttempts: meta.routeReadAttempts };
    console.error("[stock-list-read] failure", { ...readMeta, errorCode });
    try {
      const snapshot = allowStaleSnapshotFallback ? await getStockSnapshot() : null;
      if (snapshot?.vehicles?.length) {
        return NextResponse.json({
          ok: true,
          vehicles: snapshot.vehicles,
          total: snapshot.total,
          version: snapshot.version,
          sourceName: snapshot.sourceName,
          snapshot: true,
          stale: true,
          warning: stockReadUserMessage(errorCode),
          meta: { ...readMeta, loaded: snapshot.vehicles.length, total: snapshot.total, complete: snapshot.vehicles.length >= snapshot.total }
        });
      }
    } catch {}
    return NextResponse.json({
      ok: false,
      errorCode,
      message: stockReadUserMessage(errorCode),
      retryable,
      meta: readMeta
    }, { status: retryable ? 503 : errorCode === "configuration_error" ? 500 : 502 });
  }
}
