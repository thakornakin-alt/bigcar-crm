import type { ReportHistoryItem } from "@/lib/types";

const ORDINARY_SPACING_PATTERN = /\s+/g;

function normalizeSearchText(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("th-TH");
}

function normalizePlateSearchText(value: unknown): string {
  return normalizeSearchText(value).replace(ORDINARY_SPACING_PATTERN, "");
}

export function filterDocumentSalesReports(
  reports: readonly ReportHistoryItem[],
  searchText: string
): ReportHistoryItem[] {
  const query = normalizeSearchText(searchText);
  if (!query) return reports.slice();

  const plateQuery = normalizePlateSearchText(query);

  return reports.filter((report) => {
    const searchableValues = [
      report.customerName,
      report.phone,
      report.id,
      report.saleName
    ];

    if (searchableValues.some((value) => normalizeSearchText(value).includes(query))) {
      return true;
    }

    return Boolean(plateQuery) && (
      normalizePlateSearchText(report.plate).includes(plateQuery)
      || normalizePlateSearchText(report.phone).includes(plateQuery)
    );
  });
}
