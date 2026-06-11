import { NextResponse } from "next/server";
import { importStock } from "@/lib/apps-script";
import type { StockVehicle } from "@/lib/types";
import { saveStockExtraFields } from "@/lib/stock-extra-fields";
import { sanitizeStockText, sanitizeStockVehicleTextFields } from "@/lib/stock-text-sanitizer";
import { clearLineReservations } from "@/lib/line-reservations";

export const dynamic = "force-dynamic";

function cleanRow(row: Partial<StockVehicle>): StockVehicle {
  const rawExtraFields = row.extraFields && typeof row.extraFields === "object" ? row.extraFields : {};
  const extraFields = Object.fromEntries(
    Object.entries(rawExtraFields)
      .map(([key, value]) => [sanitizeStockText(key), sanitizeStockText(value)])
      .filter(([key, value]) => key && value)
  );

  return sanitizeStockVehicleTextFields({
    plate: String(row.plate || ""),
    brand: String(row.brand || "").trim(),
    model: String(row.model || ""),
    year: String(row.year || "").trim(),
    color: String(row.color || ""),
    salePrice: String(row.salePrice || "").trim(),
    source: String(row.source || "").trim(),
    ownership: String(row.ownership || "").trim(),
    reportReturnDate: String(row.reportReturnDate || "").trim(),
    agingGroup: String(row.agingGroup || "").trim(),
    aging: String(row.aging || "").trim(),
    customerName: String(row.customerName || "").trim(),
    project: String(row.project || "").trim(),
    campaign: String(row.campaign || "").trim(),
    colorGroup: String(row.colorGroup || "").trim(),
    closedSales: String(row.closedSales || "").trim(),
    inspection: String(row.inspection || "").trim(),
    extendedWarranty: String(row.extendedWarranty || "").trim(),
    sellerName: String(row.sellerName || "").trim(),
    bookingSaleDate: String(row.bookingSaleDate || "").trim(),
    vin: String(row.vin || "").trim(),
    engineNo: String(row.engineNo || "").trim(),
    financeName: String(row.financeName || "").trim(),
    finalGrade: String(row.finalGrade || "").trim(),
    program: String(row.program || "").trim(),
    parkingLocation: String(row.parkingLocation || ""),
    status: String(row.status || ""),
    gear: String(row.gear || ""),
    mileage: String(row.mileage || "").trim(),
    pdiStatus: String(row.pdiStatus || "").trim(),
    pdiNote: String(row.pdiNote || "").trim(),
    vehicleGroup: String(row.vehicleGroup || "").trim(),
    extraFields
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows)
      ? body.rows.map((row: Partial<StockVehicle>) => cleanRow(row)).filter((row: StockVehicle) => row.plate)
      : [];
    const sourceName = String(body.sourceName || "").trim();
    const clearExisting = body.clearExisting === true;
    const clearReservationsOnComplete = body.clearLineReservationsOnComplete === true;

    if (!rows.length) {
      return NextResponse.json({ error: "No stock rows to import" }, { status: 400 });
    }

    const result = await importStock({ rows, sourceName, clearExisting });
    await saveStockExtraFields(rows, { clearExisting });
    const lineReservationsClearResult = clearReservationsOnComplete
      ? await clearLineReservations()
      : { clearedCount: 0 };
    if (clearReservationsOnComplete) {
      console.info("[stock-import] cleared LINE reservations after manual import", {
        clearedCount: lineReservationsClearResult.clearedCount,
        sourceName,
        rows: rows.length
      });
    }
    return NextResponse.json({
      result: {
        ...result,
        lineReservationsCleared: lineReservationsClearResult.clearedCount,
        clientVinRows: rows.filter((row: StockVehicle) => row.vin).length,
        clientEngineNoRows: rows.filter((row: StockVehicle) => row.engineNo).length,
        clientStatusRows: rows.filter((row: StockVehicle) => row.status).length,
        clientVehicleGroupRows: rows.filter((row: StockVehicle) => row.vehicleGroup).length,
        clientPdiNoteRows: rows.filter((row: StockVehicle) => row.pdiNote).length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import stock" },
      { status: 500 }
    );
  }
}
