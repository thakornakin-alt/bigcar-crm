import { NextResponse } from "next/server";
import { updateReportStatus } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    const type = String(body.type || "").trim();
    const status = String(body.status || "").trim();

    if (!id || !type || !status) {
      return NextResponse.json({ error: "Report id, type and status are required" }, { status: 400 });
    }

    const report = await updateReportStatus({ id, type, status });
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update report status" },
      { status: 500 }
    );
  }
}
