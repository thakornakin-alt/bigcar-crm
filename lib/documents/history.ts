import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { DocumentHistoryItem } from "@/lib/documents/document-types";

const STORE_FILE = "document-history.json";

export async function listDocumentHistory() {
  return readJsonStore<DocumentHistoryItem[]>(STORE_FILE, []);
}

export async function saveDocumentHistory(input: Omit<DocumentHistoryItem, "id" | "createdAt">) {
  const history = await listDocumentHistory();
  const item: DocumentHistoryItem = {
    ...input,
    id: `DOC-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  history.unshift(item);
  await writeJsonStore(STORE_FILE, history.slice(0, 300));
  return item;
}
