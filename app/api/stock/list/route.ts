import { NextResponse } from "next/server";
import { listStockVehicles } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("query") || "").trim();
    const limit = Number(searchParams.get("limit") || 250);
    const data = await listStockVehicles({ query, limit });
    return NextResponse.json(data);
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
