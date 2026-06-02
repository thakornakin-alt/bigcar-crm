import { NextResponse } from "next/server";
import { listStockVehicles, lookupStockByPlate } from "@/lib/apps-script";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import type { StockVehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function pickValue(row: Record<string, unknown>, keys: string[]) {
  const extraFields = row.extraFields && typeof row.extraFields === "object"
    ? row.extraFields as Record<string, unknown>
    : {};

  for (const key of keys) {
    const value = row[key] ?? extraFields[key];
    if (value !== undefined && value !== null && text(value)) return text(value);
  }
  return "";
}

function normalizeLookupVehicle(vehicle: StockVehicle | null) {
  if (!vehicle) return null;
  const raw = vehicle as StockVehicle & Record<string, unknown>;
  return {
    ...vehicle,
    vin:
      text(vehicle.vin) ||
      pickValue(raw, ["vin", "chassisNo", "chassisNumber", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]),
    engineNo:
      text(vehicle.engineNo) ||
      pickValue(raw, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"])
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plate = String(searchParams.get("plate") || "").trim();

    if (!plate) {
      return NextResponse.json({ vehicle: null });
    }

    const vehicle = await lookupStockByPlate(plate);
    const [mergedVehicle] = await mergeStockExtraFields(vehicle ? [vehicle] : []);
    const normalized = normalizeLookupVehicle(mergedVehicle || vehicle);

    if (searchParams.get("debug") === "1") {
      const listed = await listStockVehicles({ query: plate, limit: 10 }).catch(() => ({ vehicles: [], total: 0 }));
      const mergedListed = await mergeStockExtraFields(listed.vehicles || []);
      const normalizedPlate = plate.replace(/\s+/g, "").toUpperCase();
      const exactListed = mergedListed.find((item) => String(item.plate || "").replace(/\s+/g, "").toUpperCase() === normalizedPlate) || null;
      const exactRaw = exactListed as (StockVehicle & Record<string, unknown>) | null;
      return NextResponse.json({
        vehicle: normalized,
        debug: {
          lookupKeys: vehicle ? Object.keys(vehicle as StockVehicle & Record<string, unknown>) : [],
          lookupEngineNo: vehicle ? pickValue(vehicle as StockVehicle & Record<string, unknown>, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]) : "",
          lookupVin: vehicle ? pickValue(vehicle as StockVehicle & Record<string, unknown>, ["vin", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]) : "",
          listCount: listed.vehicles?.length || 0,
          exactListKeys: exactRaw ? Object.keys(exactRaw) : [],
          exactListEngineNo: exactRaw ? pickValue(exactRaw, ["engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]) : "",
          exactListVin: exactRaw ? pickValue(exactRaw, ["vin", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]) : "",
          exactListExtraFields: exactRaw?.extraFields || {}
        }
      });
    }

    return NextResponse.json({ vehicle: normalized });
  } catch (error) {
    return NextResponse.json(
      { vehicle: null, warning: error instanceof Error ? error.message : "Unable to lookup stock" },
      { status: 200 }
    );
  }
}
