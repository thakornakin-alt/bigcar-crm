"use client";

import { useEffect } from "react";

function normalizePlate(value: string) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/\s*(?:กทม\.?|กรุงเทพ(?:มหานคร)?)\s*$/i, "").replace(/[.\-_/\\\s]+/g, "").trim();
}

type CanvasState = {
  lastRect?: { x: number; y: number; w: number; h: number };
  reservedRow?: { y: number; h: number; plateX: number; plateW: number; plate: string };
};

let activePlateKeys = new Set<string>();
let canvasPatched = false;
const canvasStates = new WeakMap<CanvasRenderingContext2D, CanvasState>();

function installCanvasReservationPatch() {
  if (canvasPatched || typeof window === "undefined" || typeof CanvasRenderingContext2D === "undefined") return;
  canvasPatched = true;
  const proto = CanvasRenderingContext2D.prototype;
  const originalFillRect = proto.fillRect;
  const originalStrokeRect = proto.strokeRect;
  const originalFillText = proto.fillText;

  proto.fillRect = function (x: number, y: number, w: number, h: number) {
    const state = canvasStates.get(this) || {};
    state.lastRect = { x, y, w, h };
    canvasStates.set(this, state);
    const row = state.reservedRow;
    if (row && Math.abs(y - row.y) < 1 && Math.abs(h - row.h) < 1) {
      const previous = this.fillStyle;
      this.fillStyle = "#fee2e2";
      originalFillRect.call(this, x, y, w, h);
      this.fillStyle = previous;
      return;
    }
    originalFillRect.call(this, x, y, w, h);
  };

  proto.strokeRect = function (x: number, y: number, w: number, h: number) {
    const state = canvasStates.get(this);
    const row = state?.reservedRow;
    if (row && Math.abs(y - row.y) < 1 && Math.abs(h - row.h) < 1) {
      const previous = this.strokeStyle;
      this.strokeStyle = "#ef4444";
      originalStrokeRect.call(this, x, y, w, h);
      this.strokeStyle = previous;
      return;
    }
    originalStrokeRect.call(this, x, y, w, h);
  };

  proto.fillText = function (text: string, x: number, y: number, maxWidth?: number) {
    const value = String(text || "");
    const normalized = normalizePlate(value);
    const state = canvasStates.get(this) || {};

    if (activePlateKeys.has(normalized) && state.lastRect && state.lastRect.h >= 40) {
      const cell = state.lastRect;
      state.reservedRow = { y: cell.y, h: cell.h, plateX: cell.x, plateW: cell.w, plate: value };
      canvasStates.set(this, state);
      const previousFill = this.fillStyle;
      const previousStroke = this.strokeStyle;
      this.fillStyle = "#fee2e2";
      originalFillRect.call(this, cell.x, cell.y, cell.w, cell.h);
      this.strokeStyle = "#ef4444";
      originalStrokeRect.call(this, cell.x, cell.y, cell.w, cell.h);
      this.fillStyle = previousFill;
      this.strokeStyle = previousStroke;
      if (maxWidth === undefined) originalFillText.call(this, text, x, y);
      else originalFillText.call(this, text, x, y, maxWidth);
      return;
    }

    if (/BOOKING/i.test(value) && state.reservedRow) {
      const row = state.reservedRow;
      const previousFill = this.fillStyle;
      const previousStroke = this.strokeStyle;
      const previousFont = this.font;
      const previousAlign = this.textAlign;
      const previousBaseline = this.textBaseline;
      this.fillStyle = "#fee2e2";
      originalFillRect.call(this, row.plateX, row.y, row.plateW, row.h);
      this.strokeStyle = "#ef4444";
      originalStrokeRect.call(this, row.plateX, row.y, row.plateW, row.h);
      this.fillStyle = "#111827";
      this.font = "700 18px Arial, Tahoma, sans-serif";
      this.textAlign = "left";
      this.textBaseline = "middle";
      originalFillText.call(this, row.plate, row.plateX + 12, row.y + row.h / 2, Math.max(20, row.plateW - 24));
      this.fillStyle = previousFill;
      this.strokeStyle = previousStroke;
      this.font = previousFont;
      this.textAlign = previousAlign;
      this.textBaseline = previousBaseline;
      return;
    }

    if (maxWidth === undefined) originalFillText.call(this, text, x, y);
    else originalFillText.call(this, text, x, y, maxWidth);
  };
}

function plateFromRow(row: HTMLElement) {
  const cells = Array.from(row.querySelectorAll<HTMLElement>("td"));
  for (const cell of cells) {
    const text = String(cell.textContent || "").replace(/📅?\s*BOOKING/gi, " ").replace(/ติดจองรอคอนเฟิร์ม/g, " ").trim();
    const normalized = normalizePlate(text);
    if (activePlateKeys.has(normalized)) return normalized;
    for (const plate of activePlateKeys) {
      if (plate && normalized.includes(plate)) return plate;
    }
  }
  return "";
}

function removeReservationBadges(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("span,div,p").forEach((node) => {
    const text = String(node.textContent || "").trim();
    if (/^(?:📅\s*)?BOOKING$/i.test(text) || text === "ติดจองรอคอนเฟิร์ม") node.remove();
  });
}

function markReservedElement(element: HTMLElement) {
  element.dataset.lineReservation = "true";
  element.classList.add("line-reserved-stock-row");
  element.style.background = "rgba(239, 68, 68, 0.18)";
  element.style.boxShadow = "inset 4px 0 0 #ef4444";
  element.querySelectorAll<HTMLElement>("td").forEach((cell) => {
    cell.style.background = "rgba(254, 226, 226, 0.82)";
    cell.style.borderColor = "rgba(239, 68, 68, 0.38)";
  });
  removeReservationBadges(element);
}

async function syncLineReservationCards() {
  try {
    const response = await fetch("/api/line/reservations", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json() as { activePlates?: string[] };
    activePlateKeys = new Set((data.activePlates || []).map(normalizePlate).filter(Boolean));
    installCanvasReservationPatch();
    if (!activePlateKeys.size) return;

    document.querySelectorAll<HTMLElement>(".stock-bigcar-brand article").forEach((card) => {
      const text = normalizePlate(card.textContent || "");
      if (!Array.from(activePlateKeys).some((plate) => text.includes(plate))) return;
      card.dataset.lineReservation = "true";
      card.classList.add("line-reserved-stock-card");
      card.style.background = "rgba(239, 68, 68, 0.18)";
      card.style.boxShadow = "inset 4px 0 0 #ef4444";
      removeReservationBadges(card);
    });

    document.querySelectorAll<HTMLElement>("table tbody tr").forEach((row) => {
      const plate = plateFromRow(row);
      if (!plate) return;
      markReservedElement(row);
    });
  } catch {
    // Stock remains usable even if reservation decoration cannot be loaded.
  }
}

export default function LineReservationCardMarker() {
  useEffect(() => {
    installCanvasReservationPatch();
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => { queued = false; void syncLineReservationCards(); }, 80);
    };
    void syncLineReservationCards();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
