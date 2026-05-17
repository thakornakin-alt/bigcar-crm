import { NextResponse } from "next/server";
import { lookupCustomerById } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idCard = String(searchParams.get("idCard") || "").trim();

    if (!idCard) {
      return NextResponse.json({ customer: null });
    }

    const customer = await lookupCustomerById(idCard);
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { customer: null, warning: error instanceof Error ? error.message : "Unable to lookup customer" },
      { status: 200 }
    );
  }
}
