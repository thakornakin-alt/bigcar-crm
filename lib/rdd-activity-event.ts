import type { RddActivityEvent, SalesUser } from "@/lib/types";
import { profileActivityName } from "@/lib/user-profile";

export function buildRddActivityEvent(
  user: SalesUser | null | undefined,
  input: Omit<RddActivityEvent, "id" | "occurredAt" | "actorUserId" | "actorName" | "actorRole">
) {
  return {
    ...input,
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
    actorUserId: user?.id || "",
    actorName: user ? profileActivityName(user) : "",
    actorRole: user?.role || ""
  } satisfies RddActivityEvent;
}
