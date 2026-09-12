import { NextResponse } from "next/server";
import { getStockImportStatus, importStock } from "@/lib/apps-script";
import { clearAllLineReservations } from "@/lib/line-reservations";
import type { StockVehicle } from "@/lib/types";
import { saveStockExtraFields } from "@/lib/stock-extra-fields";
import {
  beginStockImportIntegrity,
  finishStockImportIntegrity,
  normalizedStockPlate,
  uniqueStockPlateCount
} from "@/lib/stock-import-integrity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cleanRow(row: Partial<StockVehicle>): StockVehicle {
  const rawExtraFields = row.extraFields && typeof row.extraFields === "object" ? row.extraFields : {};
  const extraFields = Object.fromEntries(
    Object.entries(rawExtraFields)
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => key && value)
  );

  return {
    plate: String(row.plate || "").trim(),
    brand: String(row.brand || "").trim(),
    model: String(row.model || "").trim(),
    year: String(row.year || "").trim(),
    color: String(row.color || "").trim(),
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
    parkingLocation: String(row.parkingLocation || "").trim(),
    status: String(row.status || "").trim(),
    gear: String(row.gear || "").trim(),
    mileage: String(row.mileage || "").trim(),
    pdiStatus: String(row.pdiStatus || "").trim(),
    pdiNote: String(row.pdiNote || "").trim(),
    vehicleGroup: String(row.vehicleGroup || "").trim(),
    extraFields
  };
}

export async function POST(request: Request) {
  let sourceName = "";
  let expectedTotal = 0;
  let persistedTotal = 0;
  let startedAt = "";
  try {
    const body = await request.json();
    const rows: StockVehicle[] = Array.isArray(body.rows)
      ? body.rows.map((row: Partial<StockVehicle>) => cleanRow(row)).filter((row: StockVehicle) => row.plate)
      : [];
    sourceName = String(body.sourceName || "").trim() || "manual";
    const clearExisting = body.clearExisting === true;

    if (!rows.length) {
      return NextResponse.json({ error: "No stock rows to import" }, { status: 400 });
    }
    if (rows.length > 1000) {
      return NextResponse.json({ error: "รองรับการ Import สูงสุด 1,000 คันต่อไฟล์" }, { status: 400 });
    }

    expectedTotal = uniqueStockPlateCount(rows);
    if (expectedTotal !== rows.length) {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      rows.forEach((row) => {
        const plate = normalizedStockPlate(row.plate);
        if (seen.has(plate)) duplicates.add(row.plate);
        seen.add(plate);
      });
      return NextResponse.json(
        { error: `พบทะเบียนซ้ำในไฟล์ ${rows.length - expectedTotal} รายการ: ${[...duplicates].slice(0, 5).join(", ")}` },
        { status: 400 }
      );
    }

    const started = await beginStockImportIntegrity(sourceName, expectedTotal);
    startedAt = started.startedAt;

    const result = await importStock({ rows, sourceName, clearExisting });
    const destinationStatus = await getStockImportStatus();
    persistedTotal = destinationStatus.total;
    const expectedDestinationTotal = clearExisting ? expectedTotal : destinationStatus.total;
    const integrity = await finishStockImportIntegrity({
      sourceName,
      expectedTotal: expectedDestinationTotal,
      persistedTotal: destinationStatus.total,
      startedAt
    });
    if (integrity.status !== "complete") {
      return NextResponse.json(
        { error: integrity.message, result, status: destinationStatus, integrity },
        { status: 409 }
      );
    }

    await saveStockExtraFields(rows, { clearExisting });
    const clearedReservations = await clearAllLineReservations(`stock-import:${sourceName || "manual"}`);
    console.log(
      "[stock-import-line-reservation-clear]",
      JSON.stringify({
        sourceName: sourceName || "manual",
        clearExisting,
        clearedCount: clearedReservations.clearedCount,
        clearedAt: clearedReservations.clearedAt
      })
    );
    return NextResponse.json({
      result: {
        ...result,
        total: destinationStatus.total,
        clientVinRows: rows.filter((row: StockVehicle) => row.vin).length,
        clientEngineNoRows: rows.filter((row: StockVehicle) => row.engineNo).length,
        clientStatusRows: rows.filter((row: StockVehicle) => row.status).length,
        clientVehicleGroupRows: rows.filter((row: StockVehicle) => row.vehicleGroup).length,
        clientPdiNoteRows: rows.filter((row: StockVehicle) => row.pdiNote).length
      },
      status: destinationStatus,
      integrity,
      lineReservations: {
        cleared: true,
        clearedCount: clearedReservations.clearedCount,
        clearedAt: clearedReservations.clearedAt
      }
    });
  } catch (error) {
    if (expectedTotal > 0) {
      await finishStockImportIntegrity({
        sourceName: sourceName || "manual",
        expectedTotal,
        persistedTotal,
        startedAt,
        error: error instanceof Error ? error.message : "Unable to import stock"
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import stock" },
      { status: 500 }
    );
  }
}
