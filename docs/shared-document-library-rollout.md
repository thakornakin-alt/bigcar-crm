# Shared Document Library — safe rollout plan

Scope: download/library side only, shared between bigcar-crm and rdd-sales-hub.

## Protected boundaries
- DO NOT modify components/documents/DocumentGeneratorV2.tsx or its API routes, document template overrides, PDF generation, OCR, or form mappings.
- Preserve existing app/documents/page.tsx view switch and existing DocumentCenter until replacement has passed tests.
- Do not change /api/stock/list, /api/reports/history, Apps Script, LINE webhooks, booking, or existing Supabase table names.
- Do not repurpose the current document template API as the shared library API.

## Proposed isolated design (not deployed)
- Separate metadata tables: shared_library_files, shared_library_file_versions, shared_library_audit; no migration of existing CRM tables.
- Private Supabase Storage bucket with versioned object paths; avoid overwriting existing objects.
- API namespace /api/shared-documents/*, permission checks on every read/write, time-limited signed downloads, MIME and size validation.
- Per-file visibility: web1, web2, both; admin-only write and soft-delete, audit changes.
- Independent read/write feature flags default OFF; no automatic enablement.
- PDF-to-JPG/PNG via browser-side PDF.js, lazy loaded on demand; do not touch generator PDF code.
- If shared storage credentials are missing or fail, show a non-blocking library error; legacy download templates remain accessible.

## Release gates
1. Verify which Supabase project each production/preview environment actually uses; never write test objects to production.
2. Inspect auth/session and role authorization before building mutation endpoints.
3. Create dedicated isolated test bucket and metadata in a non-production Supabase project.
4. Implement API and UI on feature branches; run typecheck/build and authorization/negative tests.
5. Preview smoke tests for stock, booking, LINE, existing document downloads, and document generation.
6. Review pull request; deploy only after explicit approval. Rollback: disable feature flag; keep legacy route intact.

Current state: design/scaffold only; NO migrations, storage buckets, new APIs, menu changes, or production deploys performed.
