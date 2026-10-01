import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { RouteAwareShell } from "@/app/components/route-aware-shell";
import { getRddFeatureFlags } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "BIG CAR Sales Tools",
  description: "Stock, installment calculator and approval tools"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07080a"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const flags = getRddFeatureFlags();
  const workspaceEnabled = flags.workspaceReadOnly || flags.workspaceEdit;
  return (
    <html lang="th">
      <body>
        <RouteAwareShell rddShellEnabled={flags.shell} workspaceEnabled={workspaceEnabled} commissionEnabled={flags.commissionPreview}>{children}</RouteAwareShell>
      </body>
    </html>
  );
}
