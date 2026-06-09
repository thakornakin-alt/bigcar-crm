# ROADMAP_STATUS

## Current State

### งานที่เสร็จแล้ว
- Realtime Booking V2 ใช้งานเป็นหน้าหลักแล้ว
- Booking Delivery core, booking ID, snapshot, workflow fields, alert summary, dashboard linkage ทำงานแล้ว
- Production Apps Script connectivity และ Gmail Draft production ผ่านแล้ว
- `/api/booking-delivery` ได้ timing headers ชั่วคราวเพื่อ debug performance

### งานที่กำลังทำ
- Hotfix แก้ `ENOENT: no such file or directory, mkdir '/var/task/.data'`
- ตรวจและปรับ storage path ให้ปลอดภัยบน Vercel

### งานถัดไป
- ยืนยันว่า create queue / save booking / booking-delivery write ใช้ `/tmp` หรือ Supabase บน Vercel แทน `/var/task`
- รัน build และตรวจ production อีกครั้ง

### ไฟล์สำคัญที่เกี่ยวข้อง
- `lib/json-store.ts`
- `lib/realtime-booking.ts`
- `lib/realtime-booking-v2.ts`
- `app/api/booking-delivery/route.ts`
- `app/api/booking-reports/route.ts`
- `app/api/realtime-booking-v2/*`
- `app/realtime-booking/page.tsx`
- `app/realtime-booking-v2/page.tsx`
