import { NextResponse } from "next/server";
import { listStockVehicles } from "@/lib/apps-script";
import type { StockVehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    vehicleGroup:
      text(vehicle.vehicleGroup) ||
      pickValue(raw, ["VehicleGroup", "vehicle_group", "กลุ่มรถยนต์", "กลุ่มรถ", "กลุ่ม"])
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("query") || "").trim();
    const limit = Number(searchParams.get("limit") || 250);
    const data = await listStockVehicles({ query, limit });
    return NextResponse.json({
      ...data,
      vehicles: (data.vehicles || []).map(normalizeStockVehicle)
    });
  } catch (error) {
    return NextResponse.json(
      {
        vehicles: [],
        total: 0,
        warning: error instanceof Error ? error.message : "Unable to load stock"
      },
      { status: 200 }
    );
  }
}
