export type DocumentOtherExpense = {
  id: string;
  label: string;
  amount: number;
  note?: string;
};

export type MoneyParseResult =
  | { ok: true; value: number | undefined }
  | { ok: false; error: string };

const MONEY_PATTERN = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export const DOCUMENT_MONEY_KEYS = new Set([
  "sellPrice", "salePrice", "finalPrice", "deposit", "remainingAmount", "bookingPrice", "downPayment",
  "financeAmount", "netCarPrice", "discount", "discountPrice", "line2Discount", "line4Installment",
  "line5DownPayment", "line6Amount", "line7Amount", "line8Amount", "line9Amount", "line10Amount",
  "line11Amount", "line12Amount", "line13Amount", "line14Amount", "transfer_sale_price"
]);

export const SALES_CONTRACT_OVERRIDE_KEYS = [
  "contractDate",
  "paymentDate",
  "customerName",
  "customerAddress",
  "idCard",
  "brand",
  "model",
  "plateNo",
  "engineNo",
  "chassisNo",
  "sellPrice",
  "deposit",
  "remainingAmount"
] as const;

export function salesContractOverrideData(input: unknown): Record<string, string> {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return Object.fromEntries(
    SALES_CONTRACT_OVERRIDE_KEYS
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, identifierText(source[key])])
  );
}

export function identifierText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function parseDocumentMoney(input: unknown): MoneyParseResult {
  const raw = identifierText(input);
  if (!raw) return { ok: true, value: undefined };
  if (!MONEY_PATTERN.test(raw)) {
    return { ok: false, error: "รูปแบบจำนวนเงินไม่ถูกต้อง" };
  }
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return { ok: false, error: "จำนวนเงินไม่ถูกต้อง" };
  return { ok: true, value };
}

export function formatDocumentMoney(value: unknown): string {
  const parsed = typeof value === "number" ? { ok: Number.isFinite(value), value } : parseDocumentMoney(value);
  if (!parsed.ok || parsed.value === undefined) return "";
  const hasDecimal = Math.round(parsed.value) !== parsed.value;
  return parsed.value.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2
  });
}

export function normalizeDocumentMoney(input: unknown): MoneyParseResult & { formatted?: string } {
  const parsed = parseDocumentMoney(input);
  return parsed.ok
    ? { ...parsed, formatted: parsed.value === undefined ? "" : formatDocumentMoney(parsed.value) }
    : parsed;
}

export function normalizeDocumentValueRecord(input: unknown): Record<string, string> {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(source).map(([rawKey, rawValue]) => {
    const key = identifierText(rawKey);
    const value = identifierText(rawValue);
    if (!DOCUMENT_MONEY_KEYS.has(key) || !value) return [key, value];
    const parsed = parseDocumentMoney(value);
    if (!parsed.ok || parsed.value === undefined) throw new Error(`รูปแบบจำนวนเงินใน ${key} ไม่ถูกต้อง`);
    return [key, formatDocumentMoney(parsed.value)];
  }));
}

export function normalizeOtherExpenses(input: unknown): DocumentOtherExpense[] {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const parsed = parseDocumentMoney(source.amount);
    if (!parsed.ok || parsed.value === undefined) throw new Error(`จำนวนเงินค่าใช้จ่ายลำดับ ${index + 1} ไม่ถูกต้อง`);
    const label = identifierText(source.label);
    if (!label) throw new Error(`กรุณาระบุชื่อค่าใช้จ่ายลำดับ ${index + 1}`);
    return {
      id: identifierText(source.id) || `expense-${index + 1}`,
      label,
      amount: parsed.value,
      ...(identifierText(source.note) ? { note: identifierText(source.note) } : {})
    };
  });
}
