import type { RddActivityEvent, SalesUser } from "@/lib/types";

function actorName(user: SalesUser | null | undefined) {
  if (!user) return "";
  return [user.nickname, user.firstName, user.lastName].filter(Boolean).join(" / ") || user.email;
}

export function buildRddActivityEvent(
  user: SalesUser | null | undefined,
  input: Omit<RddActivityEvent, "id" | "occurredAt" | "actorUserId" | "actorName" | "actorRole">
) {
  return {
    ...input,
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
    actorUserId: user?.id || "",
    actorName: actorName(user),
    actorRole: user?.role || ""
  } satisfies RddActivityEvent;
}

