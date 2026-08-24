import { NextResponse } from "next/server";
import { addSalesLead, listSalesLeads, updateSalesLead } from "@/lib/leads";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireUser, requireWritableUser, salesUserOwnerName } from "@/lib/request-user";
import { filterByOwnership, ownershipScope } from "@/lib/rdd-ownership";

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser();
    const leads = await listSalesLeads();
    const visibleLeads = filterByOwnership(leads, ownershipScope(new URL(request.url).searchParams.get("scope")), currentUser.id);
    return NextResponse.json({ leads: visibleLeads, total: leads.length });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดลูกค้ามุ่งหวังไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireWritableUser();
    const body = await request.json();
    const lead = await addSalesLead({
      name: body.name,
      phone: body.phone,
      vehicleGroup: body.vehicleGroup,
      desiredModel: body.desiredModel,
      budget: body.budget,
      comment: body.comment,
      status: body.status,
      nextFollowUpDate: body.nextFollowUpDate,
      ownerId: currentUser.id,
      ownerName: salesUserOwnerName(currentUser)
    });
    await recordActivity(currentUser, {
      action: "lead.create", targetType: "lead", targetId: lead.id, source: "api",
      after: { status: lead.status, ownerId: lead.ownerId || "" }
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกลูกค้ามุ่งหวังไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireWritableUser();
    const body = await request.json();
    const existing = (await listSalesLeads()).find((lead) => lead.id === String(body.id || "").trim());
    if (!existing) return NextResponse.json({ error: "ไม่พบลูกค้ามุ่งหวัง" }, { status: 404 });
    const lead = await updateSalesLead(existing.id, {
      name: body.name, phone: body.phone, vehicleGroup: body.vehicleGroup, desiredModel: body.desiredModel,
      budget: body.budget, comment: body.comment, status: body.status, nextFollowUpDate: body.nextFollowUpDate,
      ownerId: existing.ownerId, ownerName: existing.ownerName
    });
    await recordActivity(currentUser, {
      action: "lead.update", targetType: "lead", targetId: lead.id, source: "api",
      before: { status: existing.status, ownerId: existing.ownerId || "" },
      after: { status: lead.status, ownerId: lead.ownerId || "" }
    });
    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกลูกค้ามุ่งหวังไม่สำเร็จ" }, { status: 400 });
  }
}
