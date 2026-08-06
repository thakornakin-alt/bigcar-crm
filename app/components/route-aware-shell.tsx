"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GlobalNav } from "@/app/components/ui";
import { isPublicWebsitePath } from "@/lib/crm-route-policy";

export function RouteAwareShell({ children, rddShellEnabled }: { children: ReactNode; rddShellEnabled: boolean }) {
  const pathname = usePathname();
  const isPublic = isPublicWebsitePath(pathname);

  if (isPublic) return <>{children}</>;
  return (
    <div className={rddShellEnabled ? "rdd-crm-shell" : undefined}>
      <GlobalNav />
      {children}
    </div>
  );
}

