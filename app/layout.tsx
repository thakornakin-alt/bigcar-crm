import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { RouteAwareShell } from "@/app/components/route-aware-shell";
import { getRddFeatureFlags } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Big Car CRM",
  description: "Mobile CRM for used car sales teams"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#08090b"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const flags = getRddFeatureFlags();
  return (
    <html lang="th">
      <body>
        <RouteAwareShell rddShellEnabled={flags.shell} workspaceEnabled={flags.workspaceReadOnly} commissionEnabled={flags.commissionPreview}>{children}</RouteAwareShell>
      </body>
    </html>
  );
}
