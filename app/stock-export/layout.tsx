import type { ReactNode } from "react";
import LineReservationCardMarker from "./line-reservation-card-marker";

export default function StockExportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LineReservationCardMarker />
      <style>{`
        .stock-bigcar-brand article.line-reserved-stock-card {
          border-color: rgba(239, 68, 68, 0.78) !important;
          background: linear-gradient(145deg, rgba(127, 29, 29, 0.48), rgba(69, 10, 10, 0.38)) !important;
          box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.22), 0 16px 42px rgba(220, 38, 38, 0.24) !important;
        }
        .stock-bigcar-brand article.line-reserved-stock-card [class*="bg-brand/"] {
          background-color: rgba(127, 29, 29, 0.26) !important;
        }

        /* Export renderer v4 is a table. Keep every vehicle detail readable while
           making the complete LINE-reserved row the reservation indicator. */
        table tbody tr.line-reserved-stock-row,
        table tbody tr.line-reserved-stock-row > td {
          background-color: rgba(239, 68, 68, 0.16) !important;
        }
        table tbody tr.line-reserved-stock-row {
          box-shadow: inset 5px 0 0 rgba(220, 38, 38, 0.95), inset -1px 0 0 rgba(239, 68, 68, 0.45), inset 0 1px 0 rgba(239, 68, 68, 0.55), inset 0 -1px 0 rgba(239, 68, 68, 0.55) !important;
        }
        table tbody tr.line-reserved-stock-row > td {
          border-color: rgba(239, 68, 68, 0.28) !important;
        }
      `}</style>
      {children}
    </>
  );
}
