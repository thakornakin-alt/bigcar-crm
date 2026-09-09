export const DEFAULT_BOOKING_DRAFT_TO = "RDDUsedcarBooked@segroup.co.th";
export const DEFAULT_BOOKING_DRAFT_CC = "rongsarit.s@tgh.co.th";

export function resolveBookingDraftRecipients(_input: { to?: unknown; cc?: unknown; bcc?: unknown } = {}) {
  return { status: "resolved" as const, to: DEFAULT_BOOKING_DRAFT_TO, cc: DEFAULT_BOOKING_DRAFT_CC, bcc: "" };
}
