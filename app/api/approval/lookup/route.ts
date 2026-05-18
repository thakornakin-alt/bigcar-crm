import { NextResponse } from "next/server";
import { lookupApprovalBookingByPlate, lookupApprovalStockByPlate, lookupStockByPlate } from "@/lib/apps-script";
import type { ApprovalStockVehicle, StockVehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

function mapFallbackVehicle(vehicle: StockVehicle | null): ApprovalStockVehicle | null {
  if (!vehicle) return null;
  return {
    plate: vehicle.plate,
    vin: vehicle.vin || "",
    model: [vehicle.brand, vehicle.model].filter(Boolean).join(" "),
    registeredYear: vehicle.year,
    finalGrade: vehicle.finalGrade || "",
    project: vehicle.project,
    program: vehicle.program || vehicle.campaign || "",
    salePrice: vehicle.salePrice,
    parkingLocation: vehicle.parkingLocation || ""
  };
}

function mergeVehicle(primary: ApprovalStockVehicle | null, fallback: ApprovalStockVehicle | null) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return {
    plate: primary.plate || fallback.plate,
    vin: primary.vin || fallback.vin,
    model: primary.model || fallback.model,
    registeredYear: primary.registeredYear || fallback.registeredYear,
    finalGrade: primary.finalGrade || fallback.finalGrade,
    project: primary.project || fallback.project,
    program: primary.program || fallback.program,
    salePrice: primary.salePrice || fallback.salePrice,
    parkingLocation: primary.parkingLocation || fallback.parkingLocation
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plate = String(searchParams.get("plate") || "").trim();

    if (!plate) {
      return NextResponse.json({ vehicle: null, booking: null });
    }

    const [primaryVehicle, fallbackStock, booking] = await Promise.all([
      lookupApprovalStockByPlate(plate),
      lookupStockByPlate(plate),
      lookupApprovalBookingByPlate(plate)
    ]);
    const fallbackVehicle = mapFallbackVehicle(fallbackStock);
    const vehicle = mergeVehicle(primaryVehicle, fallbackVehicle);

    return NextResponse.json({ vehicle, booking });
  } catch (error) {
    return NextResponse.json(
      { vehicle: null, booking: null, error: error instanceof Error ? error.message : "Unable to lookup approval data" },
      { status: 200 }
    );
  }
}
