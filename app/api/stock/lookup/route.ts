import { NextResponse } from "next/server";
import { lookupStockByPlate } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plate = String(searchParams.get("plate") || "").trim();

    if (!plate) {
      return NextResponse.json({ vehicle: null });
    }

    const vehicle = await lookupStockByPlate(plate);
    return NextResponse.json({ vehicle });
  } catch (error) {
    return NextResponse.json(
      { vehicle: null, warning: error instanceof Error ? error.message : "Unable to lookup stock" },
      { status: 200 }
    );
  }
}
