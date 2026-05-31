import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocument, PDFFont } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { DocumentData } from "@/lib/documents/document-types";

GlobalWorkerOptions.workerSrc = "";

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

function normalizePlaceholder(value: string) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

const placeholderAliases: Record<string, string[]> = {
  CUSTOMER_NAME: ["customerName"],
  CUSTOMER_ADDRESS: ["customerAddress", "address"],
  CUSTOMER_PHONE: ["phone"],
  LICENSE_PLATE: ["plate", "plateNumber"],
  CAR_MODEL: ["carModel", "model"],
  ENGINE_NO: ["engineNo", "engineNumber"],
  CHASSIS_NO: ["vin", "chassisNumber"],
  SELL_PRICE: ["salePrice", "price", "finalPrice"],
  DOWN_PAYMENT: ["bookingPrice", "downPayment"],
  BALANCE_AMOUNT: ["financeAmount", "netCarPrice"],
  CONTRACT_DATE: ["transactionDate", "bookingDate"]
};

function valueFromPlaceholder(placeholder: string, data: DocumentData) {
  const aliases = placeholderAliases[placeholder] || [];
  for (const key of aliases) {
    const value = textValue(data[key]);
    if (value) return value;
  }
  return "";
}

export async function replacePdfPlaceholders(input: {
  sourcePdfBytes: Uint8Array;
  pdfDoc: PDFDocument;
  pages: Array<ReturnType<PDFDocument["getPages"]>[number]>;
  font: PDFFont;
  data: DocumentData;
}) {
  const loadingTask = getDocument({ data: input.sourcePdfBytes });
  const source = await loadingTask.promise;

  for (let pageIndex = 0; pageIndex < source.numPages; pageIndex += 1) {
    const page = await source.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    const items = textContent.items as TextItem[];
    const targetPage = input.pages[pageIndex];
    if (!targetPage) continue;

    for (const item of items) {
      const placeholder = normalizePlaceholder(item.str);
      if (!placeholder || !placeholderAliases[placeholder]) continue;
      const replacement = valueFromPlaceholder(placeholder, input.data);
      if (!replacement) continue;

      const [, , , d, e, f] = item.transform;
      const x = e;
      const y = f;
      const fontSize = Math.max(9, Math.abs(d || item.height || 10));
      const boxHeight = Math.max(12, Math.abs(item.height || d || 12)) + 4;
      const boxWidth = Math.max(item.width, input.font.widthOfTextAtSize(item.str, fontSize)) + 8;

      targetPage.drawRectangle({
        x: x - 2,
        y: y - 3,
        width: boxWidth,
        height: boxHeight,
        color: rgb(1, 1, 1)
      });

      targetPage.drawText(replacement, {
        x,
        y,
        size: fontSize,
        font: input.font,
        color: rgb(0.02, 0.04, 0.07)
      });
    }
  }
}
