export function normalizeCarYear(value: string) {
  const text = String(value || "").trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return match[0];

  const numeric = Number(text);
  if (numeric > 25000 && numeric < 60000) {
    const date = new Date(Date.UTC(1899, 11, 30 + numeric));
    return String(date.getUTCFullYear());
  }

  return text.replace(/[^\d]/g, "").slice(-4) || text;
}
