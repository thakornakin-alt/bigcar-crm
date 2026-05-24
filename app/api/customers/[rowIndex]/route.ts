import { NextResponse } from "next/server";
import { deleteCustomer, listCustomers, updateCustomer } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { canAccessCustomerOwner, getRequestSalesUser } from "@/lib/request-user";
import type { CustomerInput } from "@/lib/types";

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

function getRowIndex(params: { rowIndex: string }) {
  const rowIndex = Number(params.rowIndex);
  if (!Number.isInteger(rowIndex) || rowIndex <= 1) {
    throw new Error("Invalid row index");
  }
  return rowIndex;
}

export async function PUT(request: Request, { params }: { params: { rowIndex: string } }) {
  try {
    const currentUser = getRequestSalesUser();
    const rowIndex = getRowIndex(params);
    const input = cleanInput(await request.json());
    const existing = (await listCustomers()).find((customer) => customer.rowIndex === rowIndex);
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (!canAccessCustomerOwner(currentUser, existing.ownerId)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขลูกค้ารายนี้" }, { status: 403 });
    }

    if (!input.car || !input.name || !input.phone) {
      return NextResponse.json({ error: "Car, Name and Phone are required" }, { status: 400 });
    }

    const customer = await updateCustomer(rowIndex, input);
    await recordActivity(currentUser, {
      action: "customer.update",
      targetType: "customer",
      targetId: customer.no,
      detail: `${customer.name} / ${customer.car}`
    });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { rowIndex: string } }) {
  try {
    const currentUser = getRequestSalesUser();
    const rowIndex = getRowIndex(params);
    const existing = (await listCustomers()).find((customer) => customer.rowIndex === rowIndex);
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (!canAccessCustomerOwner(currentUser, existing.ownerId)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ลบลูกค้ารายนี้" }, { status: 403 });
    }
    await deleteCustomer(rowIndex);
    await recordActivity(currentUser, {
      action: "customer.delete",
      targetType: "customer",
      targetId: existing.no,
      detail: `${existing.name} / ${existing.car}`
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete customer" },
      { status: 500 }
    );
  }
}
