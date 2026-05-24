import { NextResponse } from "next/server";
import { addCustomer, listCustomers } from "@/lib/apps-script";
import { canReadAllCustomers, getRequestSalesUser, salesUserOwnerName } from "@/lib/request-user";
import type { CustomerInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function cleanInput(body: Partial<CustomerInput>): CustomerInput {
  return {
    car: String(body.car || "").trim(),
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    note: String(body.note || "").trim(),
    ownerId: String(body.ownerId || "").trim(),
    ownerName: String(body.ownerName || "").trim()
  };
}

export async function GET() {
  try {
    const currentUser = getRequestSalesUser();
    const customers = await listCustomers();
    const visibleCustomers =
      currentUser && !canReadAllCustomers(currentUser)
        ? customers.filter((customer) => customer.ownerId === currentUser.id)
        : customers;
    return NextResponse.json({ customers: visibleCustomers, total: customers.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = getRequestSalesUser();
    const input = cleanInput(await request.json());
    if (currentUser) {
      input.ownerId = currentUser.id;
      input.ownerName = salesUserOwnerName(currentUser);
    }

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
