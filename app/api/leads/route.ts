import { NextResponse } from "next/server";
import { addSalesLead, listSalesLeads } from "@/lib/leads";
import { canReadAllCustomers, getRequestSalesUser, salesUserOwnerName } from "@/lib/request-user";

export async function GET() {
  try {
    const currentUser = getRequestSalesUser();
    const leads = await listSalesLeads();
    const visibleLeads =
      currentUser && !canReadAllCustomers(currentUser)
        ? leads.filter((lead) => lead.ownerId === currentUser.id)
        : leads;
    return NextResponse.json({ leads: visibleLeads, total: leads.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดลูกค้ามุ่งหวังไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = getRequestSalesUser();
    const body = await request.json();
    const lead = await addSalesLead({
      name: body.name,
      phone: body.phone,
      vehicleGroup: body.vehicleGroup,
      budget: body.budget,
      comment: body.comment,
      ownerId: currentUser?.id || "",
      ownerName: currentUser ? salesUserOwnerName(currentUser) : ""
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกลูกค้ามุ่งหวังไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
