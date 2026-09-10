import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { GlobalNav } from "@/app/components/ui";
import { LineReservationAutoRefresh } from "@/app/components/LineReservationAutoRefresh";

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
  return (
    <html lang="th">
      <body>
        <GlobalNav />
        <LineReservationAutoRefresh />
        {children}
      </body>
    </html>
  );
}
