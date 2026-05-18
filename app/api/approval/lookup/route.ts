import { NextResponse } from "next/server";
import { lookupApprovalBookingByPlate, lookupApprovalStockByPlate } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plate = String(searchParams.get("plate") || "").trim();

    if (!plate) {
      return NextResponse.json({ vehicle: null, booking: null });
    }

    const [vehicle, booking] = await Promise.all([
      lookupApprovalStockByPlate(plate),
      lookupApprovalBookingByPlate(plate)
    ]);

    return NextResponse.json({ vehicle, booking });
  } catch (error) {
    return NextResponse.json(
      { vehicle: null, booking: null, error: error instanceof Error ? error.message : "Unable to lookup approval data" },
      { status: 200 }
    );
  }
}
