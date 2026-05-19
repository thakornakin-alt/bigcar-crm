import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { fileId: string } }) {
  const fileId = String(params.fileId || "").trim();

  if (!fileId) {
    return NextResponse.json({ error: "File id is required" }, { status: 400 });
  }

  return NextResponse.redirect(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`);
}
