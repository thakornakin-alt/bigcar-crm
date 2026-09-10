"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REFRESH_MS = 15000;

export function LineReservationAutoRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/stock-export") return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      window.location.reload();
    }, REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
