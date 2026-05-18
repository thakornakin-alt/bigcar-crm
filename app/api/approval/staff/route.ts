import { NextResponse } from "next/server";
import { getStaffList } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getStaffList();
    return NextResponse.json({ staff });
  } catch (error) {
    return NextResponse.json(
      { staff: [], error: error instanceof Error ? error.message : "Unable to load staff" },
      { status: 200 }
    );
  }
}
