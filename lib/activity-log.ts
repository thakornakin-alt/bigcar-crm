import { saveActivityLog } from "@/lib/apps-script";
import type { ActivityLogInput, SalesUser } from "@/lib/types";

export function activityUserName(user: SalesUser | null | undefined) {
  if (!user) return "";
  return [user.nickname, user.firstName, user.lastName].filter(Boolean).join(" / ") || user.email;
}

export async function recordActivity(user: SalesUser | null | undefined, input: Omit<ActivityLogInput, "userId" | "userName" | "role">) {
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
