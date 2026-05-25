# BIG CAR CRM Supabase Storage Setup

ใช้สำหรับเก็บข้อมูลที่เดิมอยู่ใน `.data` ให้ถาวรบน production:

- Calendar
- ลูกค้ามุ่งหวัง
- รอส่งมอบ / Checklist / วันที่งานรถ

## 1. สร้างตาราง

เปิด Supabase Dashboard > SQL Editor แล้วรันไฟล์นี้:

```sql
-- supabase/schema.sql
```

หรือคัดลอกเนื้อหาใน `supabase/schema.sql` ไปรันทั้งหมด

## 2. ตั้ง Environment Variables

บน Vercel หรือ `.env.local`:

```env
BIG_CAR_STORE_PROVIDER=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_CRM_STORE_TABLE=big_car_crm_store
```

สำคัญ:

- `SUPABASE_SERVICE_ROLE_KEY` ต้องอยู่ฝั่ง server เท่านั้น
- ห้ามตั้งเป็น `NEXT_PUBLIC_*`
- ถ้ายังไม่พร้อมใช้ Supabase ให้ตั้ง `BIG_CAR_STORE_PROVIDER=json` ระบบจะกลับไปใช้ `.data`

## 3. ทดสอบ

1. เปิด `/calendar` แล้วเพิ่มงาน
2. เปิด `/leads` แล้วเพิ่มลูกค้ามุ่งหวัง
3. เปิด `/vehicle-prep` แล้วบันทึก checklist หรือวันที่
4. กลับไปดูใน Supabase table `big_car_crm_store`

ข้อมูลจะถูกเก็บเป็น JSON ตาม key:

- `calendar-events.json`
- `sales-leads.json`
- `vehicle-prep.json`
