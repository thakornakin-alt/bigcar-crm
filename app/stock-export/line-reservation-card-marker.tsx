"use client";

import { useEffect } from "react";

const SOURCE_LABEL = "ติดจองรอคอนเฟิร์ม";

function syncLineReservationCards(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".stock-bigcar-brand article").forEach((card) => {
    const label = Array.from(card.querySelectorAll<HTMLElement>("span.truncate"))
      .find((node) => node.textContent?.trim() === SOURCE_LABEL);

    if (!label) return;

    card.dataset.lineReservation = "true";
    card.classList.add("line-reserved-stock-card");
    label.textContent = "LINE จองแล้ว";
    const badge = label.parentElement;
    badge?.classList.remove("border-amber-300/30", "bg-amber-300/10", "text-amber-100");
    badge?.classList.add("border-red-400/60", "bg-red-500/20", "text-red-100");
  });
}

export default function LineReservationCardMarker() {
  useEffect(() => {
    syncLineReservationCards();
    const observer = new MutationObserver(() => syncLineReservationCards());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
