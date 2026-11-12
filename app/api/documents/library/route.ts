import { NextResponse } from "next/server";
import { requireAdmin, requireUser, RequestAuthError } from "@/lib/request-user";
import { addLibraryFile, DOCUMENT_MAX_BYTES, listDownloadLibrary } from "@/lib/documents/download-library";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(error: unknown) {
  const status = error instanceof RequestAuthError ? error.status : error instanceof Error ? 400 : 500;
  const message = error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const user = await requireUser();
    const items = await listDownloadLibrary();
    return NextResponse.json({
      items: items.map(({ storagePath, createdBy, ...item }) => item),
      canManage: user.role === "admin" || user.role === "super_admin"
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const category = String(form.get("category") || "เอกสารทั่วไป").trim();
    const description = String(form.get("description") || "").trim();
    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์เอกสาร" }, { status: 400 });
    }
    if (!title || title.length > 120) return NextResponse.json({ error: "กรุณากรอกชื่อเอกสารไม่เกิน 120 ตัวอักษร" }, { status: 400 });
    if (file.size > DOCUMENT_MAX_BYTES || !file.size) return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 3 MB" }, { status: 400 });
    const item = await addLibraryFile({
      title,
      category,
      description,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
      createdBy: user.id
    });
    const { storagePath, createdBy, ...publicItem } = item;
    return NextResponse.json({ item: publicItem }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
