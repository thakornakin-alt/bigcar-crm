const fallbackPath = "/dashboard";
const validationOrigin = "https://bigcar.invalid";

export function safeReturnTo(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallbackPath;
  }

  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallbackPath;

    const destination = new URL(candidate, validationOrigin);
    if (destination.origin !== validationOrigin) return fallbackPath;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallbackPath;
  }
}
