import { listSalesUsers } from "@/lib/apps-script";
import { getCaseOwnership, type CaseOwnershipType } from "@/lib/case-ownership";
import { profileActivityName } from "@/lib/user-profile";
import type { SalesUser } from "@/lib/types";

export type OperationalEmailEvent = "booking_report_draft" | "sales_report_draft" | "owner_notification" | "approval_requested";
export type EmailRouteResolution = {
  status: "resolved" | "unresolved_email_route";
  eventType: OperationalEmailEvent;
  entityId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  sender: { type: "apps_script_execution_account"; displayName: "BIG CAR CRM" };
  recipient: { to: string; cc: string; bcc: string; type: "owner" | "approved_team" | "approval" } | null;
  reason?: "ownership_not_found" | "owner_not_found" | "owner_inactive" | "owner_email_invalid" | "route_not_configured";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_REPORT_TO = "RDDUsedcarBooked@segroup.co.th";

function caseTypeForEvent(eventType: OperationalEmailEvent): CaseOwnershipType {
  if (eventType === "booking_report_draft") return "booking";
  if (eventType === "sales_report_draft") return "sales";
  if (eventType === "approval_requested") return "approval";
  throw new Error("CASE_TYPE_REQUIRED_FOR_OWNER_NOTIFICATION");
}

function configuredRoute(eventType: OperationalEmailEvent, ownerEmail: string) {
  if (eventType === "owner_notification") return { to: ownerEmail, cc: "", bcc: "", type: "owner" as const };
  if (eventType === "booking_report_draft") return { to: process.env.BOOKING_REPORT_EMAIL_TO || DEFAULT_REPORT_TO, cc: ownerEmail, bcc: "", type: "approved_team" as const };
  if (eventType === "sales_report_draft") return { to: process.env.SALES_REPORT_EMAIL_TO || DEFAULT_REPORT_TO, cc: ownerEmail, bcc: "", type: "approved_team" as const };
  const to = String(process.env.APPROVAL_EMAIL_TO || "").trim();
  return to ? { to, cc: ownerEmail, bcc: "", type: "approval" as const } : null;
}

export async function resolveEmailRoute(input: { ownerUserId?: string; eventType: OperationalEmailEvent; entityId: string; entityType?: CaseOwnershipType }): Promise<EmailRouteResolution> {
  const entityId = String(input.entityId || "").trim();
  const ownership = input.ownerUserId ? null : await getCaseOwnership(input.entityType || caseTypeForEvent(input.eventType), entityId);
  const ownerUserId = String(input.ownerUserId || ownership?.ownerUserId || "").trim();
  return resolveEmailRouteFromRecords({ eventType: input.eventType, entityId, ownerUserId, users: await listSalesUsers() });
}

export function resolveEmailRouteFromRecords(input: { eventType: OperationalEmailEvent; entityId: string; ownerUserId: string; users: SalesUser[] }): EmailRouteResolution {
  const { eventType, entityId, ownerUserId } = input;
  const base = { eventType, entityId, ownerUserId, ownerDisplayName: "", ownerEmail: "", sender: { type: "apps_script_execution_account" as const, displayName: "BIG CAR CRM" as const } };
  if (!ownerUserId) return { ...base, status: "unresolved_email_route", recipient: null, reason: "ownership_not_found" };
  const owner = input.users.find((user) => user.id === ownerUserId);
  if (!owner) return { ...base, status: "unresolved_email_route", recipient: null, reason: "owner_not_found" };
  const ownerDisplayName = profileActivityName(owner);
  const ownerEmail = String(owner.email || "").trim().toLowerCase();
  const resolvedBase = { ...base, ownerDisplayName, ownerEmail };
  if (owner.locked) return { ...resolvedBase, status: "unresolved_email_route", recipient: null, reason: "owner_inactive" };
  if (!emailPattern.test(ownerEmail)) return { ...resolvedBase, status: "unresolved_email_route", recipient: null, reason: "owner_email_invalid" };
  const recipient = configuredRoute(eventType, ownerEmail);
  if (!recipient || !emailPattern.test(recipient.to)) return { ...resolvedBase, status: "unresolved_email_route", recipient: null, reason: "route_not_configured" };
  return { ...resolvedBase, status: "resolved", recipient };
}

export function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}
