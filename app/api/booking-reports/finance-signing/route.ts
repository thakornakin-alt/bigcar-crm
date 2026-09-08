import { NextResponse } from "next/server";
import { lookupStockByPlateDetailed, searchBookingReports } from "@/lib/apps-script";
import { getBookingFinanceMetadata, saveBookingFinanceMetadata } from "@/lib/booking-finance-metadata";
import { blankBookingFinanceSigning, type BookingFinanceCreditStatus } from "@/lib/booking-finance-signing";
import { getCaseOwnership } from "@/lib/case-ownership";
import { RequestAuthError, requireUser, requireWritableUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function mayAccess(user: Awaited<ReturnType<typeof requireUser>>, ownerUserId: string) {
  return user.role === "admin" || user.role === "super_admin" || user.id === ownerUserId;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const bookingReportId = clean(new URL(request.url).searchParams.get("bookingReportId"));
    if (!bookingReportId) return NextResponse.json({ error: "bookingReportId is required" }, { status: 400 });
    const ownership = await getCaseOwnership("booking", bookingReportId);
    if (!ownership || !mayAccess(user, ownership.ownerUserId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ metadata: await getBookingFinanceMetadata(bookingReportId) });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load finance signing metadata" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWritableUser();
    const body = await request.json() as Record<string, unknown>;
    const bookingReportId = clean(body.bookingReportId);
    if (!bookingReportId) return NextResponse.json({ error: "bookingReportId is required" }, { status: 400 });
    const ownership = await getCaseOwnership("booking", bookingReportId);
    if (!ownership || !mayAccess(user, ownership.ownerUserId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const reports = await searchBookingReports(bookingReportId);
    const booking = reports.find((report) => report.id === bookingReportId);
    if (!booking) return NextResponse.json({ error: "ไม่พบรายงานจอง" }, { status: 404 });
    const existingMetadata = await getBookingFinanceMetadata(bookingReportId);
    const stock = await lookupStockByPlateDetailed(booking.plate);
    const credit = clean(body.creditStatus);
    const creditStatus: BookingFinanceCreditStatus = ["มี", "ไม่มี", "ไม่ทราบ"].includes(credit) ? credit as BookingFinanceCreditStatus : "";
    const financePrice = clean(body.financePrice);
    const requestedSource = clean(body.financePriceSource);
    const stockPrice = clean(stock.vehicle?.salePrice) || clean(existingMetadata?.stockPrice);
    const financePriceSource = financePrice
      ? requestedSource === "stock" && financePrice === stockPrice ? "stock" : "manual"
      : "";
    const now = new Date().toISOString();
    const metadata = await saveBookingFinanceMetadata({
      ...blankBookingFinanceSigning,
      bookingReportId,
      ownerUserId: ownership.ownerUserId,
      stockPrice,
      stockPlate: clean(stock.vehicle?.plate || booking.plate),
      financeCompany: clean(body.financeCompany),
      signingLocation: clean(body.signingLocation),
      occupation: clean(body.occupation),
      employmentDuration: clean(body.employmentDuration),
      income: clean(body.income),
      creditStatus,
      financePrice,
      financePriceSource,
      downPayment: clean(body.downPayment),
      createdAt: now,
      updatedAt: now
    });
    return NextResponse.json({ metadata });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save finance signing metadata" }, { status: 500 });
  }
}
