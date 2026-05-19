import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { fileId: string } }) {
  const fileId = String(params.fileId || "").trim();

  if (!fileId) {
    return NextResponse.json({ error: "File id is required" }, { status: 400 });
  }

  const driveUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const response = await fetch(driveUrl, {
    headers: {
      "User-Agent": "BigCarCRM/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Unable to fetch image from Google Drive" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Google Drive file is not an image" }, { status: 415 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300"
    }
  });
}
