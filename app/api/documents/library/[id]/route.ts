import { NextResponse } from "next/server";
import { requireAdmin, requireUser, RequestAuthError } from "@/lib/request-user";
import { findLibraryFile, getStoredFile, removeLibraryFile } from "@/lib/documents/download-library";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

function fail(error: unknown) {
  const status = error instanceof RequestAuthError ? error.status : 500;
  return NextResponse.json(
    { error: error instanceof RequestAuthError ? error.message : "ไม่สามารถเปิดเอกสารได้" },
    { status }
  );
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireUser();
    const item = await findLibraryFile(params.id);
    if (!item) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });
    const response = await getStoredFile(item);
    if (!response.ok || !response.body) return NextResponse.json({ error: "ไม่สามารถอ่านไฟล์เอกสารได้" }, { status: 502 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const canPreview = item.mimeType === "application/pdf" || item.mimeType.startsWith("image/");
    const disposition = download || !canPreview ? "attachment" : "inline";
    const safeFallback = item.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
    const encoded = encodeURIComponent(item.fileName);
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": item.mimeType,
        "Content-Disposition": `${disposition}; filename="${safeFallback}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const deleted = await removeLibraryFile(params.id);
    if (!deleted) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
