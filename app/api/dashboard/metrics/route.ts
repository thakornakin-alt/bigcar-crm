import { NextResponse } from "next/server";
import { listReportHistory, listSalesUsers } from "@/lib/apps-script";
import { listBookingDeliveryRecords } from "@/lib/booking-delivery";
import { listCaseOwnership } from "@/lib/case-ownership";
import { derivePersonalDashboardMetrics, normalizeDashboardMonth } from "@/lib/dashboard-personal-metrics";
import { listSalesLeads } from "@/lib/leads";
import { RequestAuthError, requireUser } from "@/lib/request-user";
import { listVehiclePrepRecords } from "@/lib/vehicle-prep";

export const dynamic = "force-dynamic";
const blankMetrics = { leads: 0, newLeadsToday: 0, bookings: 0, financeWaiting: 0, waitingDelivery: 0, delivered: 0, bookingDeliveries: 0, bookingDeliveriesPending: 0, todayEvents: 0 };

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const url = new URL(request.url);
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const canSelectUser = actor.role === "admin" || actor.role === "super_admin";
    if (requestedUserId && !canSelectUser && requestedUserId !== actor.id) {
      return NextResponse.json({ error: "ไม่อนุญาตให้ดูข้อมูลของผู้ใช้อื่น" }, { status: 403 });
    }
    const month = normalizeDashboardMonth(url.searchParams.get("month"));
    const users = await listSalesUsers();
    const targetUserId = canSelectUser && requestedUserId ? requestedUserId : actor.id;
    const target = users.find((user) => user.id === targetUserId && !user.locked);
    if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้ที่เลือก" }, { status: 404 });
    const [leadsResult, reportsResult, prepResult, deliveryResult, ownershipResult] = await Promise.allSettled([
      listSalesLeads(), listReportHistory("", "all"), listVehiclePrepRecords(), listBookingDeliveryRecords(), listCaseOwnership()
    ]);
    const failures: string[] = [];
    if (leadsResult.status === "rejected") failures.push("leads");
    if (reportsResult.status === "rejected") failures.push("reports");
    if (prepResult.status === "rejected") failures.push("vehicle_prep");
    if (deliveryResult.status === "rejected") failures.push("booking_delivery");
    if (ownershipResult.status === "rejected") failures.push("case_ownership");
    const complete = failures.length === 0;
    const metrics = complete ? derivePersonalDashboardMetrics({
      targetUserId, month,
      leads: leadsResult.status === "fulfilled" ? leadsResult.value : [],
      reports: reportsResult.status === "fulfilled" ? reportsResult.value : [],
      prepRecords: prepResult.status === "fulfilled" ? prepResult.value : [],
      bookingDeliveries: deliveryResult.status === "fulfilled" ? deliveryResult.value : [],
      ownership: ownershipResult.status === "fulfilled" ? ownershipResult.value : [], users
    }) : blankMetrics;
    return NextResponse.json({
      metrics,
      scope: {
        month, targetUserId,
        targetDisplayName: target.nickname || [target.firstName, target.lastName].filter(Boolean).join(" ") || target.email,
        sessionUserId: actor.id, mode: "personal", canSelectUser
      },
      selectableUsers: canSelectUser ? users.filter((user) => !user.locked && user.role !== "viewer").map((user) => ({ id: user.id, displayName: user.nickname || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email, branch: user.branch || "" })) : undefined,
      complete, warnings: failures
    });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "โหลด Dashboard ไม่สำเร็จ" }, { status: 500 });
  }
}
