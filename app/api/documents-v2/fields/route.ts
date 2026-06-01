import { NextResponse } from "next/server";
import { listTemplateFieldsV2 } from "@/lib/documents-v2/generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = String(searchParams.get("templateId") || "").trim();
    const result = await listTemplateFieldsV2(templateId || undefined);
    const fieldNames = result.fields.map((field) => field.name);
    return NextResponse.json({
      ok: true,
      ...result,
      debug: {
        selectedTemplate: {
          id: result.templateId,
          fileName: result.templateFile,
          path: result.templatePath
        },
        fetchStatus: 200,
        fieldsCount: result.fields.length,
        fieldNames
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "โหลด fields ไม่สำเร็จ"
      },
      { status: 500 }
    );
  }
}
