import { NextResponse } from "next/server";
import { addCustomer, listCustomers } from "@/lib/apps-script";
import type { CustomerInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function cleanInput(body: Partial<CustomerInput>) {
  return {
    car: String(body.car || "").trim(),
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    note: String(body.note || "").trim()
  };
}

export async function GET() {
  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = cleanInput(await request.json());

    if (!input.car || !input.name || !input.phone) {
      return NextResponse.json({ error: "Car, Name and Phone are required" }, { status: 400 });
    }

    const customer = await addCustomer(input);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save customer" },
      { status: 500 }
    );
  }
}
