import { NextResponse } from "next/server";
import { listBookingDeliveryRecords } from "@/lib/booking-delivery";
import { calculateFuelAllowance, calculateVehicleCommission, calculateWeightedCount, createCommissionRuleSet, lookupMonthlyStep } from "@/lib/commission";
import { RequestAuthError, requireUser } from "@/lib/request-user";
import type { BookingDeliveryRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function text(value: unknown) { return String(value ?? "").trim(); }
function money(value: unknown) {
  const raw = text(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!raw) return undefined;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}
function bangkokMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "";
  const month = parts.find((item) => item.type === "month")?.value || "";
  return `${year}-${month}`;
}
function monthOf(value: unknown) {
  const match = text(value).match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}
function belongsTo(record: BookingDeliveryRecord, user: { id: string; firstName: string; lastName: string }) {
  if (text(record.salespersonUserId)) return text(record.salespersonUserId) === user.id;
  const saleName = text(record.saleName);
  const fullName = [text(user.firstName), text(user.lastName)].filter(Boolean).join(" ");
  return Boolean(saleName && (saleName === text(user.firstName) || saleName === fullName));
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const requestedMonth = new URL(request.url).searchParams.get("month") || bangkokMonth();
    if (!/^\d{4}-\d{2}$/.test(requestedMonth)) return NextResponse.json({ error: "เดือนไม่ถูกต้อง" }, { status: 400 });
    const rules = createCommissionRuleSet(requestedMonth);
    const all = await listBookingDeliveryRecords();
    const mine = all.filter((record) => belongsTo(record, user) && record.qaTestRecord !== true && record.excludeFromMetrics !== true && record.isCounted !== false);
    const delivered = mine.filter((record) => (record.caseStatus === "delivered" || record.workflowStatus === "ยอดส่งมอบ") && monthOf(record.deliveredAt) === requestedMonth);

    const items = delivered.map((record) => {
      const standardPrice = money(record.salePrice);
      const salePrice = money(record.finalPrice);
      const explicitDiscount = money(record.centralDiscount);
      const derivedDiscount = standardPrice !== undefined && salePrice !== undefined ? standardPrice - salePrice : undefined;
      const discountAmount = explicitDiscount ?? (derivedDiscount !== undefined && derivedDiscount >= 0 ? derivedDiscount : undefined);
      const issues: string[] = [];
      if (!record.commissionGroup) issues.push("ไม่มี Commission Group");
      if (standardPrice === undefined) issues.push("ไม่มีราคามาตรฐาน");
      if (salePrice === undefined) issues.push("ไม่มีราคาขาย");
      if (discountAmount === undefined) issues.push("ส่วนลดไม่ถูกต้อง");
      if (!record.deliveredAt) issues.push("ไม่มีวันส่งมอบจริง");
      if (issues.length || !record.commissionGroup || discountAmount === undefined) {
        return { id: record.id, plate: record.plate, model: [record.brand, record.model, record.year].filter(Boolean).join(" "), deliveredAt: record.deliveredAt, group: record.commissionGroup, standardPrice, salePrice, discountAmount, status: "needs_review" as const, issues };
      }
      const result = calculateVehicleCommission({ group: record.commissionGroup, discountAmount }, rules);
      return { id: record.id, plate: record.plate, model: [record.brand, record.model, record.year].filter(Boolean).join(" "), deliveredAt: record.deliveredAt, group: record.commissionGroup, standardPrice, salePrice, discountAmount, status: "ready" as const, issues: [], ...result };
    });

    const ready = items.filter((item): item is Extract<typeof item, { status: "ready" }> => item.status === "ready");
    const weightedCount = calculateWeightedCount(ready);
    const netVehicleCommission = ready.reduce((sum, item) => sum + item.netVehicleCommission, 0);
    const withholdingTax = ready.reduce((sum, item) => sum + item.withholdingTaxAmount, 0);
    const monthlyStep = lookupMonthlyStep(weightedCount, rules);
    const fuelAllowance = calculateFuelAllowance(weightedCount, rules);

    return NextResponse.json({
      mode: "real_read_only",
      month: requestedMonth,
      salesperson: { id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" "), nickname: user.nickname },
      source: "booking-delivery",
      summary: { physicalCars: ready.length, weightedCars: weightedCount, netVehicleCommission, withholdingTax, monthlyStep, fuelAllowance, finalTotal: netVehicleCommission + monthlyStep + fuelAllowance, needsReview: items.length - ready.length },
      items
    });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "โหลดค่าคอมจริงไม่สำเร็จ" }, { status: 500 });
  }
}
