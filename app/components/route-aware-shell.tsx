"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GlobalNav } from "@/app/components/ui";
import { isPublicWebsitePath } from "@/lib/crm-route-policy";

export function RouteAwareShell({ children, rddShellEnabled, workspaceEnabled }: { children: ReactNode; rddShellEnabled: boolean; workspaceEnabled: boolean }) {
  const pathname = usePathname();
  const isPublic = isPublicWebsitePath(pathname);

  if (isPublic) return <>{children}</>;
  return (
    <div className={rddShellEnabled ? "rdd-crm-shell" : undefined}>
      <GlobalNav workspaceEnabled={workspaceEnabled} />
      {children}
    </div>
  );
}
