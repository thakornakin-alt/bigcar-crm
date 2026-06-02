export type DocumentV2TemplateId = "contract-field";

export type DocumentV2Template = {
  id: DocumentV2TemplateId;
  title: string;
  fileName: string;
  path: string;
  mappingLocked?: boolean;
  hideFieldBorders?: boolean;
};

export const documentTemplatesV2: Record<DocumentV2TemplateId, DocumentV2Template> = {
  "contract-field": {
    id: "contract-field",
    title: "สัญญาซื้อขายรถยนต์",
    fileName: "contract-field.pdf",
    path: "/document-templates/contract-field.pdf",
    mappingLocked: true,
    hideFieldBorders: false
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
