import { NextResponse } from "next/server";
import { getDocumentTemplate } from "@/lib/documents/template-config";
import { generateFilledDocumentPdf } from "@/lib/documents/pdf-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const primaryTemplate = "contract" as const;
const optionalTemplates = ["temporary-receipt"] as const;

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const checks: Array<{ templateId: string; ok: boolean; detail: string; required: boolean }> = [];
    const allTemplates = [primaryTemplate, ...optionalTemplates] as const;
    for (const templateId of allTemplates) {
      try {
        const template = await getDocumentTemplate(templateId);
        if (!template) {
          checks.push({ templateId, ok: false, detail: "ไม่พบ template config", required: templateId === primaryTemplate });
          continue;
        }
        const bytes = await generateFilledDocumentPdf({
          templateId,
          baseUrl: origin,
          data: {
            customerName: "ทดสอบระบบ",
            plate: "ทด1234",
            phone: "0900000000",
            transactionDate: "2026-06-01",
            bookingDate: "2026-06-01",
            carBrand: "TOYOTA",
            carModel: "TEST",
            year: "2021",
            color: "ขาว",
            salePrice: "500000",
            bookingPrice: "10000",
            financeAmount: "490000",
            sellerName: "TEST"
          }
        });
        checks.push({
          templateId,
          ok: true,
          detail: `สร้าง PDF สำเร็จ (${bytes.length} bytes)`,
          required: templateId === primaryTemplate
        });
      } catch (error) {
        checks.push({
          templateId,
          ok: false,
          detail: error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ",
          required: templateId === primaryTemplate
        });
      }
    }

    const ok = checks
      .filter((check) => check.required)
      .every((check) => check.ok);
    return NextResponse.json({
      ok,
      checkedAt: new Date().toISOString(),
      checks
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "health check failed" },
      { status: 500 }
    );
  }
}
