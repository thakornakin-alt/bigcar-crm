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

    // LINE Reservation is indicated by the translucent red card only.
    // Do not add a replacement status label; keep the vehicle details unchanged.
    const badge = label.parentElement;
    badge?.remove();
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
