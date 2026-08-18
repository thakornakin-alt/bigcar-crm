import { NextResponse } from "next/server";
import { deleteDocumentV2Override, readDocumentV2Override, writeDocumentV2Override } from "@/lib/documents-v2/override-store";
import { RequestAuthError, requireUser, requireWritableUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof RequestAuthError ? error.status : 400;
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : fallback }, { status });
}

export async function GET(request: Request) {
  try {
    requireUser();
    const url = new URL(request.url);
    const templateId = String(url.searchParams.get("templateId") || "").trim();
    const reportId = String(url.searchParams.get("reportId") || "").trim();
    if (!templateId || !reportId) throw new Error("templateId และ reportId จำเป็นต้องมีค่า");
    return NextResponse.json({ ok: true, override: await readDocumentV2Override(templateId, reportId) });
  } catch (error) {
    return errorResponse(error, "โหลดข้อมูลแก้ไขเอกสารไม่สำเร็จ");
  }
}

export async function PUT(request: Request) {
  try {
    const actor = requireWritableUser();
    const body = await request.json();
    const saved = await writeDocumentV2Override({
      templateId: body.templateId,
      reportId: body.reportId,
      data: body.data,
      templateData: body.templateData,
      otherExpenses: body.otherExpenses,
      actorUserId: actor.id
    });
    return NextResponse.json({ ok: true, override: saved });
  } catch (error) {
    return errorResponse(error, "บันทึกข้อมูลแก้ไขเอกสารไม่สำเร็จ");
  }
}

export async function DELETE(request: Request) {
  try {
    requireWritableUser();
    const url = new URL(request.url);
    const templateId = String(url.searchParams.get("templateId") || "").trim();
    const reportId = String(url.searchParams.get("reportId") || "").trim();
    if (!templateId || !reportId) throw new Error("templateId และ reportId จำเป็นต้องมีค่า");
    await deleteDocumentV2Override(templateId, reportId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "รีเซ็ตข้อมูลแก้ไขเอกสารไม่สำเร็จ");
  }
}
