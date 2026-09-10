import type { ReactNode } from "react";
import LineReservationCardMarker from "./line-reservation-card-marker";

export default function StockExportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LineReservationCardMarker />
      <style>{`
        .stock-bigcar-brand article.line-reserved-stock-card {
          border-color: rgba(239, 68, 68, 0.78) !important;
          background: linear-gradient(145deg, rgba(127, 29, 29, 0.48), rgba(69, 10, 10, 0.34)) !important;
          box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.22), 0 16px 42px rgba(69, 10, 10, 0.24) !important;
        }
        .stock-bigcar-brand article.line-reserved-stock-card [class*="bg-brand/"] {
          background-color: rgba(127, 29, 29, 0.26) !important;
        }
      `}</style>
      {children}
    </>
  );
}
