import { NextResponse } from "next/server";
import { listTemplateFieldsV2 } from "@/lib/documents-v2/generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateFile = String(searchParams.get("templateFile") || "").trim();
    const result = await listTemplateFieldsV2(templateFile || undefined);
    const fieldNames = result.fields.map((field) => field.name);
    return NextResponse.json({
      ok: true,
      ...result,
      debug: {
        pdfUrl: `/${result.templatePath.replace(/^public\//, "")}`,
        fieldsCount: result.fields.length,
        fieldNames
      }
    });
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const templateFile = String(searchParams.get("templateFile") || "").trim();
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "โหลด fields ไม่สำเร็จ",
        templateFile,
        debug: {
          pdfUrl: templateFile ? `/document-templates/${templateFile}` : "",
          fieldsCount: 0,
          fieldNames: []
        }
      },
      { status: 500 }
    );
  }
}
