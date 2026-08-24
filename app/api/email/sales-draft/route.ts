import { NextResponse } from "next/server";
import { requireWritableUser, RequestAuthError } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireWritableUser();
    return NextResponse.json({ error: "sales_report_email_disabled" }, { status: 410 });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "sales_report_email_disabled" }, { status: 410 });
  }
}
