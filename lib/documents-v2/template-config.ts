export type DocumentV2TemplateId = "sale-contract" | "temporary-receipt";

export type DocumentV2Template = {
  id: DocumentV2TemplateId;
  title: string;
  fileName: string;
  path: string;
};

export const documentTemplatesV2: Record<DocumentV2TemplateId, DocumentV2Template> = {
  "sale-contract": {
    id: "sale-contract",
    title: "สัญญาซื้อขายรถยนต์",
    fileName: "sale-contract.pdf",
    path: "/document-templates/sale-contract.pdf"
  },
  "temporary-receipt": {
    id: "temporary-receipt",
    title: "รายละเอียดการชำระเงิน / ใบเสร็จชั่วคราว",
    fileName: "temporary-receipt.pdf",
    path: "/document-templates/temporary-receipt.pdf"
  }
};

export function getTemplateById(templateId?: string): DocumentV2Template {
  const key = (templateId || "").trim() as DocumentV2TemplateId;
  if (!key || !documentTemplatesV2[key]) {
    throw new Error("ไม่พบไฟล์ template");
  }
  return documentTemplatesV2[key];
}

export function getDocumentV2Templates(): DocumentV2Template[] {
  return Object.values(documentTemplatesV2);
}

