import { NextResponse } from "next/server";
import { listDocumentHistory, saveDocumentHistory } from "@/lib/documents/history";
import { getRequestSalesUser, salesUserOwnerName } from "@/lib/request-user";
import type { DocumentTemplateId } from "@/lib/documents/document-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await listDocumentHistory();
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดประวัติเอกสารไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getRequestSalesUser();
    const body = await request.json();
    const item = await saveDocumentHistory({
      templateId: String(body.templateId || "") as DocumentTemplateId,
      templateTitle: String(body.templateTitle || ""),
      customerName: String(body.customerName || ""),
      plate: String(body.plate || ""),
      vehicleLabel: String(body.vehicleLabel || ""),
      createdBy: user ? salesUserOwnerName(user) : String(body.createdBy || "BIG CAR CRM"),
      fileName: String(body.fileName || ""),
      referencePath: String(body.referencePath || "")
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกประวัติเอกสารไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
