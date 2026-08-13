import { notFound } from "next/navigation";
import { BookingDeliveryWorkspaceClient } from "@/components/rdd/booking-delivery-workspace-client";
import { currentBangkokMonth } from "@/lib/booking-delivery-v2";
import { getRddFeatureFlags } from "@/lib/feature-flags";
import type { OwnershipScope } from "@/lib/rdd-ownership";
import type { RddDisplayStatus, RddReminderKind } from "@/lib/rdd-phase2";

export const dynamic = "force-dynamic";

const pendingValues = new Set<RddReminderKind>(["delivery_today", "delivery_tomorrow", "delivery_overdue", "garage_return_due", "prep_pending"]);
const scopeValues = new Set<OwnershipScope>(["all", "mine", "unassigned"]);

export default function BookingDeliveryWorkspacePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (!getRddFeatureFlags().workspaceReadOnly) notFound();
  const current = currentBangkokMonth();
  const pending = typeof searchParams?.pending === "string" && pendingValues.has(searchParams.pending as RddReminderKind) ? searchParams.pending as RddReminderKind : "all";
  const scope = typeof searchParams?.scope === "string" && scopeValues.has(searchParams.scope as OwnershipScope) ? searchParams.scope as OwnershipScope : "all";
  const status = typeof searchParams?.status === "string" ? searchParams.status as RddDisplayStatus : "all";
  const search = typeof searchParams?.search === "string" ? searchParams.search : "";
  const caseId = typeof searchParams?.caseId === "string" ? searchParams.caseId : "";
  const month = typeof searchParams?.month === "string" ? searchParams.month : "";
  return <BookingDeliveryWorkspaceClient editEnabled={getRddFeatureFlags().workspaceEdit} currentYear={current.year} currentMonth={current.month} initialPending={pending} initialScope={scope} initialStatus={status} initialSearch={search} initialMonth={month} initialCaseId={caseId} />;
}
