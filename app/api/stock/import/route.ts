import { NextResponse } from "next/server";
import { importStock } from "@/lib/apps-script";
import type { StockVehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

function cleanRow(row: Partial<StockVehicle>): StockVehicle {
  return {
    plate: String(row.plate || "").trim(),
    brand: String(row.brand || "").trim(),
    model: String(row.model || "").trim(),
    year: String(row.year || "").trim(),
    color: String(row.color || "").trim(),
    salePrice: String(row.salePrice || "").trim(),
    source: String(row.source || "").trim(),
    ownership: String(row.ownership || "").trim(),
    project: String(row.project || "").trim(),
    campaign: String(row.campaign || "").trim(),
    vin: String(row.vin || "").trim(),
    finalGrade: String(row.finalGrade || "").trim(),
    program: String(row.program || "").trim(),
    parkingLocation: String(row.parkingLocation || "").trim(),
    status: String(row.status || "").trim(),
    gear: String(row.gear || "").trim(),
    mileage: String(row.mileage || "").trim(),
    pdiNote: String(row.pdiNote || "").trim(),
    vehicleGroup: String(row.vehicleGroup || "").trim()
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows)
      ? body.rows.map((row: Partial<StockVehicle>) => cleanRow(row)).filter((row: StockVehicle) => row.plate)
      : [];
    const sourceName = String(body.sourceName || "").trim();
    const clearExisting = body.clearExisting === true;

    if (!rows.length) {
      return NextResponse.json({ error: "No stock rows to import" }, { status: 400 });
    }

    const result = await importStock({ rows, sourceName, clearExisting });
    return NextResponse.json({
      result: {
        ...result,
        clientVinRows: rows.filter((row: StockVehicle) => row.vin).length,
        clientStatusRows: rows.filter((row: StockVehicle) => row.status).length,
        clientVehicleGroupRows: rows.filter((row: StockVehicle) => row.vehicleGroup).length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import stock" },
      { status: 500 }
    );
  }
}
