import { NextResponse } from "next/server";
import { deleteCustomer, updateCustomer } from "@/lib/apps-script";
import type { CustomerInput } from "@/lib/types";

function cleanInput(body: Partial<CustomerInput>) {
  return {
    car: String(body.car || "").trim(),
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    note: String(body.note || "").trim()
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
    const rowIndex = getRowIndex(params);
    const input = cleanInput(await request.json());

    if (!input.car || !input.name || !input.phone) {
      return NextResponse.json({ error: "Car, Name and Phone are required" }, { status: 400 });
    }

    const customer = await updateCustomer(rowIndex, input);
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
    const rowIndex = getRowIndex(params);
    await deleteCustomer(rowIndex);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete customer" },
      { status: 500 }
    );
  }
}
