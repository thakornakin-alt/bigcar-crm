export type DocumentTemplateId =
  | "vehicle-private-use"
  | "sale-summary"
  | "contract"
  | "payment-receipt"
  | "customer-form";

export type DocumentFieldType = "text" | "checkbox" | "date";

export type DocumentFieldConfig = {
  page: number;
  x: number;
  y: number;
  fontSize: number;
  type?: DocumentFieldType;
  width?: number;
  value?: string;
};

export type DocumentTemplateConfig = {
  id: DocumentTemplateId;
  title: string;
  description: string;
  fileName: string;
  backgroundPath: string;
  fields: Record<string, DocumentFieldConfig>;
};

export type DocumentData = Record<string, string | number | boolean | null | undefined>;

export type DocumentHistoryItem = {
  id: string;
  templateId: DocumentTemplateId;
  templateTitle: string;
  createdAt: string;
  customerName: string;
  plate: string;
  vehicleLabel: string;
  createdBy: string;
  fileName: string;
  referencePath: string;
};
