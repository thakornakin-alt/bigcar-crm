import type { BookingReport } from "@/lib/types";

function parseReportDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatThaiReportDate(value: unknown) {
  const date = parseReportDate(value);
  if (!date) return "ไม่ระบุวันที่";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatThaiReportDateTime(value: unknown) {
  const date = parseReportDate(value);
  if (!date) return "ไม่ระบุเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function latestBookingReportId(reports: Array<Pick<BookingReport, "id" | "createdAt">>) {
  let latestId = "";
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const report of reports) {
    const time = parseReportDate(report.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (time > latestTime) {
      latestTime = time;
      latestId = report.id;
    }
  }
  return latestId;
}
