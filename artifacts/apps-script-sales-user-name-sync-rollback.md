# Apps Script SalesUsers canonical-name sync rollback

Created before deployment from branch `feat/booking-delivery-v2-one-day`.

Pre-change `Code.gs` git blob: `d2d2456df221bc51eea0d6232c9863e4df3f18a1`.

Verified remote project before change:

- Project: `BIGCARCRMNEW`
- Script ID: `1UgjLYKmo9suNTOaXdRpoD9oaMFlqKw2xoUtRLDGH8N8rcZgBsRjd1mIb`
- Active deployment: `Booking Delivery V2 - BookingDate`
- Active deployment ID: `AKfycbwxSYQ113z6pD77u-qFdVcLfhmZb5RM_PDr1cfo5IpjWL-98ByPTG_bNQgMBmBovNTdAQ`
- Pre-change deployed version: `54`
- Remote editor source matched the repository baseline after newline normalization.

Scope: `updateSalesUser()` only. `SALES_USER_HEADERS` is unchanged.

To roll back, remove only these three assignments from `updateSalesUser()` and create a new Apps Script version/deployment:

```javascript
row[6]=String(input.firstName!==undefined?input.firstName:row[6]||"").trim();
row[7]=String(input.lastName!==undefined?input.lastName:row[7]||"").trim();
row[8]=String(input.nickname!==undefined?input.nickname:row[8]||"").trim();
```

Original behavior continued directly from `row[2]=now;` to the existing `row[9]` phone assignment.
