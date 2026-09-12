import { NextResponse } from "next/server";
import { listStockVehicles } from "@/lib/apps-script";
import type { StockVehicle } from "@/lib/types";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import { readStockWithBoundedRetry, StockReadFailure, stockReadUserMessage, classifyStockReadError, isRetryableStockReadError } from "@/lib/stock/stock-read-reliability";

export const dynamic = "force-dynamic";

const STOCK_LIST_SAFE_LIMIT = 5000;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function pickValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && text(value)) return text(value);
  }
  return "";
}

function normalizeStockVehicle(vehicle: StockVehicle) {
  const raw = vehicle as StockVehicle & Record<string, unknown>;
  return {
    ...vehicle,
    pdiNote:
      text(vehicle.pdiNote) ||
      pickValue(raw, ["PdiNote", "PDINote", "pdi", "PDI", "pdi_note", "pdiRemark", "remark", "note", "หมายเหตุ PDI", "หมายเหตุPDI", "หมายเหตุ"]),
    engineNo:
      text(vehicle.engineNo) ||
      pickValue(raw, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]),
    vehicleGroup:
      text(vehicle.vehicleGroup) ||
      pickValue(raw, ["VehicleGroup", "vehicle_group", "กลุ่มรถยนต์", "กลุ่มรถ", "กลุ่ม"])
  };
}

export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("query") || "").trim();
    const requestedLimit = Number(searchParams.get("limit") || STOCK_LIST_SAFE_LIMIT);
    // Stock Export historically requested 500 rows. That silently truncated larger inventories.
    // Keep accepting the legacy query parameter, but never return fewer than the safe full-stock window.
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : STOCK_LIST_SAFE_LIMIT, STOCK_LIST_SAFE_LIMIT), STOCK_LIST_SAFE_LIMIT);
    const { value: data, meta } = await readStockWithBoundedRetry(() => listStockVehicles({ query, limit }));
    const vehicles = await mergeStockExtraFields(data.vehicles || []);
    const durationMs = Date.now() - requestStartedAt;
    console.info("[stock-list-read] success", { durationMs, appsScriptDurationMs: meta.appsScriptDurationMs, attempts: meta.attempts, vehicleCount: vehicles.length, total: data.total, limit });
    return NextResponse.json({
      ...data,
      ok: true,
      vehicles: vehicles.map(normalizeStockVehicle),
      meta: { durationMs, appsScriptDurationMs: meta.appsScriptDurationMs, attempts: meta.attempts, requestedLimit, effectiveLimit: limit }
    });
  } catch (error) {
    const failure = error instanceof StockReadFailure ? error : null;
    const errorCode = failure?.code || classifyStockReadError(error);
    const retryable = failure?.retryable ?? isRetryableStockReadError(errorCode);
    const durationMs = Date.now() - requestStartedAt;
    const meta = failure?.meta || { attempts: 1, attemptDurationsMs: [durationMs], appsScriptDurationMs: durationMs };
    console.error("[stock-list-read] failure", { durationMs, appsScriptDurationMs: meta.appsScriptDurationMs, attempts: meta.attempts, errorCode });
    return NextResponse.json(
      {
        ok: false,
        errorCode,
        message: stockReadUserMessage(errorCode),
        retryable,
        meta: { durationMs, appsScriptDurationMs: meta.appsScriptDurationMs, attempts: meta.attempts }
      },
      { status: retryable ? 503 : errorCode === "configuration_error" ? 500 : 502 }
    );
  }
}
