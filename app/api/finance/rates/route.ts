import { NextResponse } from "next/server";
import { listInterestRates } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rates = await listInterestRates();
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load interest rates" },
      { status: 500 }
    );
  }
}
