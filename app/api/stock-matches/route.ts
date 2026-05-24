import { NextResponse } from "next/server";
import { listStockLeadMatches } from "@/lib/stock-matching";

export async function GET() {
  try {
    const matches = await listStockLeadMatches();
    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดรายการจับคู่ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
