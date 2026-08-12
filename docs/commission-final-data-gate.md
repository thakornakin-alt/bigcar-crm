# Commission final data gate

`COMMISSION_REAL_WRITES_ENABLED` must remain `false` until every item below has evidence and explicit approval.

- [ ] Canonical Booking Delivery dataset is readable through an authorized, read-only path.
- [ ] `salespersonUserId` readiness and unresolved identities are measured.
- [ ] `commissionGroup` readiness and unresolved/duplicate CAR GROUP joins are measured.
- [ ] Delivered status and actual `deliveredAt` dates are validated; appointment dates are not substituted.
- [ ] Standard price, final sale price, explicit discount, and derived discount conflicts are measured.
- [ ] Every `needs_review` reason is counted and understood.
- [ ] `qaTestRecord`, `excludeFromMetrics`, and `isCounted=false` exclusions are verified.
- [ ] Duplicate-recognition idempotency is verified against the selected real persistence store.
- [ ] Admin correction, reversal, and manual-adjustment permissions are approved.
- [ ] Activity actor/source policy is verified for capture, recognition, correction, and closing.
- [ ] A rollback/reversal procedure is reviewed; recognized snapshots remain immutable.
- [ ] Preview-only end-to-end verification passes without mutating an operational case.

Phase 2C does not satisfy or toggle this gate. Historical records are never backfilled automatically.
