import { NextResponse } from "next/server";
import { saveApprovalLog } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const formType = String(body.formType || "").trim();
    const plate = String(body.plate || "").trim();
    const saleName = String(body.saleName || "").trim();
    const message = String(body.message || "").trim();

    if (!formType || !message) {
      return NextResponse.json({ error: "Form type and message are required" }, { status: 400 });
    }

    const result = await saveApprovalLog({ formType, plate, saleName, message });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save approval log" },
      { status: 500 }
    );
  }
}
