# BIG CAR CRM Integration Baseline — 2026-09-12

Purpose: prevent the recurring regression where restoring or fixing one subsystem removes a newer subsystem.

## Locked base
This integration branch starts from production main commit e91e8fcafb87462aa88afcbebe2fac78db659a4d.

## Must preserve
- Current navigation and home UI
- LINE Auto Reservation / red reservation rendering
- Realtime Booking V2
- Booking / Delivery features already present in production
- Stock Export renderer V4 and its existing layout
- Existing sales/report/customer/calendar/approval/document/settings pages

## Stock completeness fixes
Do not merge an old feature branch wholesale.
1. Stock list/export must not truncate a 507-row source at 500 rows.
2. Status filter must expose actual imported Column P values dynamically rather than a fixed allowlist.
3. If backend total is greater than loaded vehicle count, export/copy/send LINE must be blocked rather than silently producing an incomplete image.
4. Validate the real 2026-09-11 source file as 507/507 registrations.
5. Validate filtered PICK-UP CAB output by registration list, not only by displayed count.

## Workspace integration rule
Workspace work on older/diverged branches must be ported selectively onto this branch only after comparing against this production base. Never replace production navigation/layout with an older branch tree.

## Release gate
No production deployment until one Preview passes all together: current navigation, required Workspace, LINE Reservation, Realtime Booking V2, complete Stock count, Dynamic Status, Stock Export V4, and PICK-UP CAB registration-list validation.
