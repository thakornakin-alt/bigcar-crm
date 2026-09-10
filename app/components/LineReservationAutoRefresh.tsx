"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REFRESH_MS = 15000;
const LINE_STATUS_TEXT = "ติดจองรอคอนเฟิร์ม";

function markLineReservedStock() {
  const nodes = Array.from(document.querySelectorAll("span"));
  nodes.forEach((node) => {
    if (node.textContent?.trim() !== LINE_STATUS_TEXT) return;

    const card = node.closest("article");
    if (card) {
      card.classList.add("line-reserved-stock-card");
      const pill = node.closest("span.inline-flex");
      pill?.classList.add("line-reservation-status-hidden");
      return;
    }

    const row = node.closest("tr");
    if (row) {
      row.classList.add("line-reserved-stock-row");
      node.classList.add("line-reservation-status-hidden");
    }
  });
}

export function LineReservationAutoRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/stock-export") return;

    markLineReservedStock();
    const observer = new MutationObserver(markLineReservedStock);
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      window.location.reload();
    }, REFRESH_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
