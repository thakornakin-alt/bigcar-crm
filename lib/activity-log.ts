import { saveActivityLog } from "@/lib/apps-script";
import type { ActivityLogInput, SalesUser } from "@/lib/types";
import { appendRddActivity } from "@/lib/rdd-activity";
import { getRddFeatureFlags } from "@/lib/feature-flags";

type ActivityDetails = Omit<ActivityLogInput, "userId" | "userName" | "role"> & {
  source?: "web" | "api" | "system";
  requestId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export function activityUserName(user: SalesUser | null | undefined) {
  if (!user) return "";
  return [user.nickname, user.firstName, user.lastName].filter(Boolean).join(" / ") || user.email;
}

export async function recordActivity(user: SalesUser | null | undefined, input: ActivityDetails) {
  if (getRddFeatureFlags().activityV2) {
    try {
      await appendRddActivity(user, {
        action: input.action,
        targetType: input.targetType || "",
        targetId: input.targetId || "",
        source: input.source || "api",
        requestId: input.requestId,
        before: input.before,
        after: input.after,
        metadata: input.metadata
      });
    } catch (error) {
      console.error("[rdd-activity] append failed", error);
    }
  }
  try {
    await saveActivityLog({
      userId: user?.id || "",
      userName: activityUserName(user),
      role: user?.role || "",
      action: input.action,
      targetType: input.targetType || "",
      targetId: input.targetId || "",
      detail: input.detail || ""
    });
  } catch {
    // Activity logging must never block the main CRM workflow.
  }
}
