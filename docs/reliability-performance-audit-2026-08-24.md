# BIG CAR CRM reliability and performance audit — 2026-08-24

Scope: Preview application only. Measurements are local fixture/build measurements; no operational records, Gmail drafts, or LINE messages were created.

## Module audit

| Module | Initial/read flow | Reliability and performance result | Priority / disposition |
|---|---|---|---|
| Login/Auth | canonical user, credential-v2 and session-version reads | permission and duplicate decisions remain fresh/no-cache; no automatic write retry | pass; no change |
| Dashboard / RDD Home | dashboard uses five independent sources; RDD reads Booking Delivery | Dashboard had two request waves, plate-based Sales association, and partial failure looked like zero; RDD cleared valid rows on failure | P0/P1/P2 fixed |
| Booking Reports | history, duplicate preflight, Stock/owner, optional group and draft calls | duplicate open-existing performs no create; create is requestId/idempotency protected; optional email/LINE remains separate from Booking write | pass; unsigned Apps Script draft boundary deferred |
| Sales Reports | exact Booking import, history, duplicate preflight, Delivery sync | exact bookingReportId remains authoritative; duplicate open-existing preserved; Sales email stays disabled | pass |
| Booking Delivery | full JSON list + client selectors; revision/stable-ID mutations | transient reads no longer clear last-known-good rows; no plate mutation fallback | P1 fixed; pagination remains P2 |
| Documents V2 | report resolve, override, generation | same-report template switch reuses snapshot; current-request guards prevent stale Preview | pass |
| Stock Export | Apps Script limit=500, optional group/reservation reads, progressive cards | bounded retry and stale preservation already present; 30.7 kB route / 134 kB first-load JS | pass; virtualization deferred until measured list threshold |
| Approval | staff/group reads, stable actor/owner, log then optional LINE | UI locking exists but no durable notification outbox | P1 deferred to outbox phase |
| Realtime Booking | Gmail polling + browser-tab LINE automation | multiple tabs/page close can interrupt or duplicate notification work | P1 deferred: move to durable server outbox |
| Commission | read-only adapters and QA exclusion | transaction IDs retained; real writes remain disabled | pass |
| Calculator | client calculation/export | no external write/retry concern; 10 kB route / 111 kB first-load JS | pass |
| Profile/Admin | canonical session/user reads and stable-ID writes | auth remains no-cache and server-authorized | pass |
| LINE groups | allowlisted groups, group summary, push | external calls had no timeout and send routes trusted browser groupId | P0/P1 fixed |
| Gmail/Google APIs | OAuth refresh, Gmail reads, Drive image proxy, central Booking draft | active fetches lacked bounded timeout | P1 fixed for app-side calls; draft Web App boundary deferred |
| JSON/Supabase stores | application JSON store, Supabase when configured | existing 9 s timeout, CAS/lock by store; safe timing emits file/count metadata only | pass |

## Policies

### Timeout matrix

| Integration | Read | Write/token exchange | Retry |
|---|---:|---:|---|
| Apps Script | 15 s | 15 s | read-only transient failure once; writes never automatic |
| LINE | 6 s group read | 10 s push | none |
| Gmail API | 12 s | — | none in this pass |
| Google OAuth | — | 10 s | none |
| Google Drive image proxy | 10 s | — | none |
| OCR.Space | 20 s | — | none |
| OpenAI OCR parsing | 25 s | — | none |
| Supabase JSON store | 9 s | 9 s | store contract only; no blind business-write retry |

### Idempotency matrix

| Operation | Key / durable contract | Retry/conflict behavior |
|---|---|---|
| Booking create / exceptional duplicate | requestId + payload fingerprint in Apps Script properties under lock | same/same returns same result; same/different conflicts |
| Sales create / exceptional duplicate | requestId + payload fingerprint in Apps Script properties under lock | same/same returns same result; same/different conflicts |
| Booking Delivery mutation | exact stable ID + revision/CAS | stale revision conflicts; never falls back to plate |
| Booking Gmail draft | notification event reservation keyed by event/entity/recipient/version | draft retry cannot repeat Booking write |
| Password reset request | token/request store + rate limit/idempotency | double request bounded; reset token one-time |
| LINE send | no durable delivery idempotency | no automatic retry; durable outbox deferred |
| Approval activity | UI submission guard; no durable request key | durable action idempotency deferred |

### Cache matrix

| Policy | Data |
|---|---|
| Static/safe | static geography and template metadata |
| Short TTL/conditional | approved group/config lists and read-only display data, only with explicit stale timestamp |
| Last-known-good | Dashboard and RDD read-only views; warning and last successful timestamp required |
| Never stale / no cache | auth/role/sessionVersion, duplicate decisions/tokens, owner identity, mutation target/revision, document override before write, Commission decisions, Booking/Sales create |

## Request-flow changes

Dashboard before: request -> four sources in parallel -> Booking Delivery sequentially (two waves) -> plate-based reduction.

Dashboard after: request -> all five sources in parallel (one wave) -> exact bookingReportId reduction -> complete/warnings -> client stores only complete result as last-known-good.

Apps Script before: one unbounded-outcome attempt after 15 s timeout, generic caller handling.

Apps Script after: correlation ID -> read allowlist only -> max two attempts with 120 ms backoff -> safe classification/duration log. Writes remain exactly one attempt.

LINE before: browser groupId -> push without timeout -> raw upstream body in error.

LINE after: authenticated actor -> approved-group lookup -> bounded push -> sanitized error classification.

## Deferred issues

1. `createBookingEmailDraft` is still an unsigned direct Apps Script Web App action. The narrow remediation is to add it to both the application signed-action set and Apps Script protected-action set, deploy an immutable Apps Script version after explicit approval, and verify unsigned rejection. It is not changed here because changing only one side would break Preview Booking drafts and Apps Script v63 deployment was not authorized.
2. Realtime Booking notification automation remains browser-tab/local-state driven. A durable server outbox with idempotency, lease, retry count, and dead-letter state is the recommended next reliability phase.
3. Approval/LINE notification delivery lacks a durable outbox. Current no-retry behavior protects the business write but cannot guarantee eventual delivery.
4. `stock-import` is the largest route at 122 kB / 223 kB first-load JS. Lazy-loading its XLSX-only workflow is a high-value P2 follow-up; it was not changed without a focused interaction benchmark.

