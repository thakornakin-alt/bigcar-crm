import { NextResponse } from "next/server";
import { getDocumentTemplate } from "@/lib/documents/template-config";
import { generateFilledDocumentPdf } from "@/lib/documents/pdf-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requiredTemplates = ["contract", "temporary-receipt"] as const;

export async function GET() {
  try {
    const checks: Array<{ templateId: string; ok: boolean; detail: string }> = [];
    for (const templateId of requiredTemplates) {
      try {
        const template = await getDocumentTemplate(templateId);
        if (!template) {
          checks.push({ templateId, ok: false, detail: "ไม่พบ template config" });
          continue;
        }
        const bytes = await generateFilledDocumentPdf({
          templateId,
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
          detail: `สร้าง PDF สำเร็จ (${bytes.length} bytes)`
        });
      } catch (error) {
        checks.push({
          templateId,
          ok: false,
          detail: error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ"
        });
      }
    }

    const ok = checks.every((check) => check.ok);
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

