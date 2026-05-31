import { NextResponse } from "next/server";
import { createStockStagingItem, listStockStagingItems } from "@/lib/stock-staging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function decodeBase64(value: string) {
  const clean = String(value || "").split(",").pop() || "";
  return Buffer.from(clean, "base64");
}

export async function GET() {
  try {
    return NextResponse.json(await listStockStagingItems());
  } catch (error) {
    return NextResponse.json(
      { items: [], latestConfirmed: null, error: error instanceof Error ? error.message : "โหลด staging ไม่สำเร็จ" },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fileName = String(body.fileName || "").trim();
    const base64 = String(body.base64 || "");
    if (!fileName || !base64) {
      return NextResponse.json({ error: "Missing fileName/base64" }, { status: 400 });
    }

    const item = await createStockStagingItem({
      bytes: decodeBase64(base64),
      fileName,
      subject: String(body.subject || fileName),
      sender: String(body.sender || "Manual Upload"),
      emailTime: String(body.emailTime || new Date().toISOString()),
      source: body.source === "gmail" ? "gmail" : "manual"
    });

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "สร้าง staging ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
