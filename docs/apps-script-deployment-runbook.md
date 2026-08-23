# BIGCARCRMNEW Apps Script deployment runbook

This runbook contains non-secret deployment metadata and safety gates for the existing BIGCARCRMNEW Apps Script project. It does not grant access and must not be used to create a replacement project or deployment.

## Verified target (read-only audit, 2026-08-23)

- Project name: `BIGCARCRMNEW`
- Script ID: `1UgjLYKmo9suNTOaXdRpoD9oaMFlqKw2xoUtRLDGH8N8rcZgBsRjd1mIb`
- Active web-app deployment ID: `AKfycbwxSYQ113z6pD77u-qFdVcLfhmZb5RM_PDr1cfo5IpjWL-98ByPTG_bNQgMBmBovNTdAQ`
- Active deployed version: `57` (Apps Script Manage deployments, 2026-08-23)
- Health/API label: `2026-08-13-01`
- Execution identity shown by Apps Script: authorized project owner account (record the account locally; never copy credentials into the repository)
- Web-app health URL: `https://script.google.com/macros/s/AKfycbwxSYQ113z6pD77u-qFdVcLfhmZb5RM_PDr1cfo5IpjWL-98ByPTG_bNQgMBmBovNTdAQ/exec`

## Repository sources and mirror gate

- Canonical review source: `google-apps-script/Code.gs`
- Compact deployment mirror: `google-apps-script/Code.compact.gs`
- Manifest: the existing Apps Script project's `appsscript.json`

`Code.gs` and `Code.compact.gs` are currently not byte-identical and differ in behavior. The deployed editor source is compact and its observable health/function inventory aligns with `Code.gs` in at least one material area (`resetUserData` is exposed), but this is not proof of complete source equality. **Do not deploy either mirror until the intended diff is reviewed, the mirrors are reconciled, and the user explicitly approves the deployment.**

Before every deployment, record SHA-256 hashes and review a normalized diff:

```powershell
Get-FileHash google-apps-script/Code.gs -Algorithm SHA256
Get-FileHash google-apps-script/Code.compact.gs -Algorithm SHA256
git diff --no-index -- google-apps-script/Code.gs google-apps-script/Code.compact.gs
```

## Authorized access paths

### Existing browser path (currently verified)

1. Sign in to the already-authorized Google account.
2. Open `https://script.google.com/home/projects/1UgjLYKmo9suNTOaXdRpoD9oaMFlqKw2xoUtRLDGH8N8rcZgBsRjd1mIb/edit`.
3. Confirm the title is exactly `BIGCARCRMNEW`.
4. Open **Deploy > Manage deployments** and confirm the deployment ID and current version above.
5. Do not click Edit/Deploy unless the user has explicitly approved the exact reviewed source diff.

### clasp path (not configured as of 2026-08-23)

No repository `.clasp.json`, local clasp credentials, or available clasp executable were found during the audit. Establishing CLI access requires an explicit interactive login using the existing authorized Google account; do not fabricate an OAuth client or copy browser tokens.

After the user approves that setup:

1. Install the official `@google/clasp` CLI using the approved workstation package policy.
2. Run `clasp login` interactively and complete Google authorization in the browser.
3. In a temporary working directory, create `.clasp.json` containing the verified Script ID and pull the project. Do not pull over reviewed repository sources.
4. Run `clasp status`, `clasp deployments`, and `clasp versions`; compare the pulled project name/source/deployment with this runbook.
5. Validate exact command flags against the installed version with `clasp deploy --help` before deployment.
6. Keep credential files outside Git. Never add `.clasprc.json`, OAuth tokens, cookies, or service-role keys to the repository.

## Read-only preflight

All checks below must pass before any source push or deployment:

1. Project title and Script ID match this runbook.
2. Active deployment ID and version are recorded.
3. Repository commit and both source hashes are recorded.
4. Pulled/editor source is compared to the reviewed repository source without overwriting it.
5. The existing health endpoint returns `ok: true` and the expected API label.
6. Only specifically approved read-only actions are exercised. Current examples include `listStockVehicles`, `listReportHistory`, `listSalesUsers`, and `lookupBookingListCommissionGroup`.
7. No Sheet-mutating action is invoked during verification.

Example health check:

```powershell
Invoke-RestMethod -Method Get -Uri "https://script.google.com/macros/s/AKfycbwxSYQ113z6pD77u-qFdVcLfhmZb5RM_PDr1cfo5IpjWL-98ByPTG_bNQgMBmBovNTdAQ/exec"
```

## Version and deployment procedure (approval required)

1. Obtain explicit approval for the exact Apps Script diff and named deployment.
2. Record the current deployment version, deployment ID, repository commit, and source hashes.
3. Reconcile and review `Code.gs` and `Code.compact.gs`; run applicable tests.
4. Push only the reviewed source to the existing Script ID using the verified browser or clasp path.
5. Create a new immutable Apps Script version with a description containing the repository commit and change scope.
6. Update the existing deployment ID to that exact new version. Do not create a new project or replacement web-app deployment.
7. Verify health, API label, and only the approved read-only actions.
8. Record the new version and verification evidence. Application Preview deployment is a separate approval and process.

## Rollback contract

Before a deployment, record the then-current version as the rollback target. The historical rollback artifact `artifacts/apps-script-sales-user-name-sync-rollback.md` records version `54` and repository blob `d2d2456df221bc51eea0d6232c9863e4df3f18a1`; those are historical evidence, not the current rollback target. At this audit, the active version is `57`.

To roll back after explicit approval:

1. In **Deploy > Manage deployments**, select the existing deployment ID.
2. Choose Edit, select the recorded prior immutable version, and deploy that version to the same deployment ID.
3. Verify health and the approved read-only checks.
4. Restore repository source only through a normal reviewed Git commit (for example from the recorded pre-deployment commit/blob); never use destructive Git reset commands.
5. Record the rollback version, timestamp, reason, and verification result.

## Approval boundaries

Explicit user approval is required for source push, version creation, deployment update, rollback, Sheet writes, credential/OAuth changes, new projects/deployments, or Production application changes. Read-only metadata, source comparison, health checks, and explicitly safe read actions may be audited without changing business data.
