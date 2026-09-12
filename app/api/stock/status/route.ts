import { NextResponse } from "next/server";
import { getStockImportStatus } from "@/lib/apps-script";
import { readStockImportIntegrity } from "@/lib/stock-import-integrity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [status, integrity] = await Promise.all([getStockImportStatus(), readStockImportIntegrity()]);
    return NextResponse.json({ status, integrity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load stock status" },
      { status: 503 }
    );
  }
}
