export const TWO_PAGE_IMAGE_TEMPLATE_IDS = new Set([
  "power-of-attorney",
  "transport-transfer-request"
]);

export function getDocumentImagePageNumbers(templateId: string, pageCount: number): number[] {
  if (!TWO_PAGE_IMAGE_TEMPLATE_IDS.has(templateId)) return [1];
  if (pageCount !== 2) throw new Error("เอกสารนี้ต้องมี 2 หน้าพอดี");
  return [1, 2];
}

export function getDocumentImageFileNames(templateId: string, baseFileName: string, pageNumbers: number[]): string[] {
  if (!TWO_PAGE_IMAGE_TEMPLATE_IDS.has(templateId)) return [baseFileName];
  const base = baseFileName.replace(/\.png$/i, "");
  return pageNumbers.map((pageNumber) => `${base}-page-${pageNumber}.png`);
}

export type ImageShareNavigator = {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

export async function shareDocumentImageFiles(
  nav: ImageShareNavigator,
  files: File[],
  title: string
): Promise<boolean> {
  if (!nav.share || !nav.canShare?.({ files })) return false;
  await nav.share({ files, title, text: "เอกสาร PNG จาก BIG CAR CRM" });
  return true;
}
