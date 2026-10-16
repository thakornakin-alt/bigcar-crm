/** Shared document library rollout guard. No existing document generator code is modified. */
export function sharedDocumentLibraryEnabled(): boolean {
  return process.env.SHARED_DOCUMENT_LIBRARY_ENABLED === "true";
}

/** Fail closed: uploads and mutations require a separate explicit switch. */
export function sharedDocumentLibraryWritesEnabled(): boolean {
  return sharedDocumentLibraryEnabled() && process.env.SHARED_DOCUMENT_LIBRARY_WRITES_ENABLED === "true";
}
