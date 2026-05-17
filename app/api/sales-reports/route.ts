import { NextResponse } from "next/server";
import { saveSalesReport } from "@/lib/apps-script";
import { renderSalesReport } from "@/lib/sales-report";
import type { SalesReportInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function clean(body: Partial<SalesReportInput>): SalesReportInput {
  const report: SalesReportInput = {
    bookingReportId: String(body.bookingReportId || "").trim(),
    customerName: String(body.customerName || "").trim(),
    phone: String(body.phone || "").trim(),
    idCard: String(body.idCard || "").trim(),
    address: String(body.address || "").trim(),
    bookingPrice: String(body.bookingPrice || "").trim(),
    plate: String(body.plate || "").trim(),
    brand: String(body.brand || "").trim(),
    model: String(body.model || "").trim(),
    year: String(body.year || "").trim(),
    color: String(body.color || "").trim(),
    salePrice: String(body.salePrice || "").trim(),
    centralDiscount: String(body.centralDiscount || "").trim(),
    finalPrice: String(body.finalPrice || "").trim(),
    paymentType: String(body.paymentType || "").trim(),
    source: String(body.source || "").trim(),
    ownership: String(body.ownership || "").trim(),
    project: String(body.project || "").trim(),
    paymentDetail: String(body.paymentDetail || "").trim(),
    saleConditions: String(body.saleConditions || "").trim(),
    saleName: String(body.saleName || "").trim(),
    teamName: String(body.teamName || "").trim(),
    branch: String(body.branch || "").trim(),
    deliveryDate: String(body.deliveryDate || "").trim(),
    reportText: "",
    status: "draft"
  };

  return { ...report, reportText: renderSalesReport(report) };
}

export async function POST(request: Request) {
  try {
    const report = clean(await request.json());
    if (!report.customerName || !report.plate || !report.saleName) {
      return NextResponse.json({ error: "Customer name, plate and sale are required" }, { status: 400 });
    }

    const saved = await saveSalesReport(report);
    return NextResponse.json({ report: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save sales report" },
      { status: 500 }
    );
  }
}
