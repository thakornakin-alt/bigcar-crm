"use client";

import { useEffect } from "react";

function normalizePlate(value: string) {
  return String(value || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s*(?:กทม\.?|กรุงเทพ(?:มหานคร)?)\s*$/i, "")
    .replace(/[.\-_/\\\s]+/g, "")
    .trim();
}

function plateFromRow(row: HTMLElement) {
  const firstCell = row.querySelector<HTMLElement>("td");
  if (!firstCell) return "";
  const text = String(firstCell.textContent || "")
    .replace(/📅?\s*BOOKING/gi, " ")
    .replace(/ติดจองรอคอนเฟิร์ม/g, " ")
    .trim();
  const candidate = text.split(/\n/).map((v) => v.trim()).find(Boolean) || text;
  return normalizePlate(candidate);
}

function removeReservationBadges(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("span,div,p").forEach((node) => {
    const text = String(node.textContent || "").trim();
    if (/^(?:📅\s*)?BOOKING$/i.test(text) || text === "ติดจองรอคอนเฟิร์ม") node.remove();
  });
}

async function syncLineReservationCards() {
  try {
    const response = await fetch("/api/line/reservations", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { activePlates?: string[] };
    const active = new Set((data.activePlates || []).map(normalizePlate).filter(Boolean));
    if (!active.size) return;

    // Normal stock cards.
    document.querySelectorAll<HTMLElement>(".stock-bigcar-brand article").forEach((card) => {
      const text = normalizePlate(card.textContent || "");
      const matched = Array.from(active).some((plate) => text.includes(plate));
      if (!matched) return;
      card.dataset.lineReservation = "true";
      card.classList.add("line-reserved-stock-card");
      removeReservationBadges(card);
    });

    // Export renderer v4 uses table rows rather than article cards.
    document.querySelectorAll<HTMLElement>("table tbody tr").forEach((row) => {
      const plate = plateFromRow(row);
      if (!plate || !active.has(plate)) return;
      row.dataset.lineReservation = "true";
      row.classList.add("line-reserved-stock-row");
      removeReservationBadges(row);
    });
  } catch {
    // Stock remains usable even if reservation decoration cannot be loaded.
  }
}

export default function LineReservationCardMarker() {
  useEffect(() => {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => {
        queued = false;
        void syncLineReservationCards();
      }, 80);
    };
    void syncLineReservationCards();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
