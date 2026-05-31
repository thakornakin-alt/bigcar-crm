import { NextResponse } from "next/server";
import { confirmStockStagingItem } from "@/lib/stock-staging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await confirmStockStagingItem(params.id, String(body.confirmedBy || "CRM User"));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm import ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
