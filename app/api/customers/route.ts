import { NextResponse } from "next/server";
import { addCustomer, listCustomers } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireUser, requireWritableUser, salesUserOwnerName } from "@/lib/request-user";
import { filterByOwnership, ownershipScope } from "@/lib/rdd-ownership";
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

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser();
    const customers = await listCustomers();
    const scope = ownershipScope(new URL(request.url).searchParams.get("scope"));
    const visibleCustomers = filterByOwnership(customers, scope, currentUser.id);
    return NextResponse.json({ customers: visibleCustomers, total: customers.length });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireWritableUser();
    const input = cleanInput(await request.json());
    input.ownerId = currentUser.id;
    input.ownerName = salesUserOwnerName(currentUser);

    if (!input.car || !input.name || !input.phone) {
      return NextResponse.json({ error: "Car, Name and Phone are required" }, { status: 400 });
    }

    const customer = await addCustomer(input);
    await recordActivity(currentUser, {
      action: "customer.create",
      targetType: "customer",
      targetId: customer.no,
      detail: `${customer.name} / ${customer.car}`,
      source: "api",
      after: { ownerId: customer.ownerId || "" }
    });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save customer" },
      { status: 500 }
    );
  }
}
