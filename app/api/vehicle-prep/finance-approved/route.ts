import { NextResponse } from "next/server";
import { markPrepFinanceApproved } from "@/lib/vehicle-prep";

export async function POST(request: Request) {
  try {
    const record = await markPrepFinanceApproved(await request.json());
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกใบอนุมัติไฟแนนซ์ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
