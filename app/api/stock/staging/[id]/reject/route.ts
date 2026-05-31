import { NextResponse } from "next/server";
import { rejectStockStagingItem } from "@/lib/stock-staging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await rejectStockStagingItem(params.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reject import ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
