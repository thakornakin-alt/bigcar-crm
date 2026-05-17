import { NextResponse } from "next/server";
import { getStockImportStatus } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getStockImportStatus();
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json(
      {
        status: { total: 0, latestImportedAt: "", latestUpdatedAt: "" },
        warning: error instanceof Error ? error.message : "Unable to load stock status"
      },
      { status: 200 }
    );
  }
}
