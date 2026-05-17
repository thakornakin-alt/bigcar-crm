# Google Apps Script Setup

ระบบนี้ไม่ใช้ Service Account, ไม่ใช้ JSON key, และไม่ใช้ `GOOGLE_CLIENT_EMAIL` หรือ `GOOGLE_PRIVATE_KEY` แล้ว

## 1. สร้าง Google Apps Script

1. เปิด [script.google.com](https://script.google.com)
2. กด `New project`
3. ตั้งชื่อโปรเจกต์ เช่น `Big Car CRM API`
4. ลบโค้ดเดิมใน `Code.gs`
5. คัดลอกโค้ดจากไฟล์ `google-apps-script/Code.gs` ไปวางแทน
6. กด Save

โค้ดนี้ตั้งค่า Sheet ID ไว้แล้ว:

```js
const SHEET_ID = "1EASeG92OYIneG6cILkU-yCdkB6krn_EX3QBDY-AN6Cc";
const SHEET_NAME = "Customers";
```

## 2. Deploy เป็น Web App

1. ในหน้า Apps Script กด `Deploy` > `New deployment`
2. กดไอคอนรูปเฟือง แล้วเลือก `Web app`
3. ตั้งค่า:
   - `Description`: `Big Car CRM API`
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
4. กด `Deploy`
5. Google จะให้อนุญาตสิทธิ์ กด authorize ด้วยบัญชีที่มีสิทธิ์แก้ Google Sheet นี้
6. คัดลอก `Web app URL`

URL จะหน้าตาประมาณนี้:

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

## 3. ใส่ URL ใน Next.js

เปิดไฟล์ `.env.local` แล้วใส่ URL ที่ได้:

```env
GOOGLE_SHEET_ID=1EASeG92OYIneG6cILkU-yCdkB6krn_EX3QBDY-AN6Cc
GOOGLE_SHEET_NAME=Customers
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

หลังแก้ `.env.local` ให้ restart dev server เพราะ Next.js โหลด env ตอนเริ่ม server

## 4. รูปแบบ API ที่ Next.js ส่งไป Apps Script

Next.js จะส่ง `POST` ไปที่ `GOOGLE_APPS_SCRIPT_URL` ทุกครั้ง

เพิ่มลูกค้า:

```json
{
  "action": "add",
  "customer": {
    "car": "Toyota Revo 2020",
    "name": "Somchai",
    "phone": "081-000-0000",
    "note": "สนใจจัดไฟแนนซ์"
  }
}
```

อ่านรายชื่อ:

```json
{
  "action": "list"
}
```

แก้ไขลูกค้า:

```json
{
  "action": "update",
  "rowIndex": 2,
  "customer": {
    "car": "Toyota Revo 2020",
    "name": "Somchai",
    "phone": "081-000-0000",
    "note": "อัปเดตโน้ต"
  }
}
```

ลบลูกค้า:

```json
{
  "action": "delete",
  "rowIndex": 2
}
```

## 5. ทดสอบ

1. เปิด Google Sheet และตรวจว่ามีแท็บชื่อ `Customers`
2. เปิด Next.js ที่ `http://localhost:3000`
3. เพิ่มลูกค้าหนึ่งรายการ
4. กลับไปดู Google Sheet ข้อมูลควรเพิ่มในแถวใหม่

ถ้า Deploy Apps Script ใหม่หลังแก้โค้ด ให้เลือก `Deploy` > `Manage deployments` > กดดินสอ > เลือก `New version` > `Deploy`

## 6. ตารางดอกเบี้ยสำหรับคำนวณค่างวด

ระบบคำนวณค่างวดใช้แท็บ `InterestRates` ใน Google Sheet

ครั้งแรกที่หน้า `/calculator` เรียก Apps Script หลัง deploy โค้ดเวอร์ชันใหม่ สคริปต์จะสร้างแท็บนี้ให้อัตโนมัติพร้อมข้อมูลตั้งต้นจากไฟล์ Excel

หัวตารางคือ:

```text
VehicleType | YearRange | Months48 | Months60 | Months72 | Months84 | Commission
```

ถ้าต้องแก้ดอกเบี้ย ให้แก้ตัวเลขในแท็บ `InterestRates` แล้ว refresh หน้า `/calculator`

## 7. เฟส 1: รายงานจอง Draft / Preview

หลังอัปเดต `Code.gs` เวอร์ชันนี้ Apps Script จะรองรับ action ใหม่:

```text
saveBookingReport
lookupStockByPlate
lookupCustomerById
```

ระบบจะสร้างแท็บใหม่เท่านั้น:

```text
BookingReports
StockInventory
```

แท็บ `Customers` และ `InterestRates` เดิมจะไม่ถูกลบหรือเปลี่ยน flow เดิม

### BookingReports

หน้า `/booking-reports` จะบันทึก Draft ลงแท็บ `BookingReports` พร้อมข้อความรายงาน, email staging fields และ metadata ไฟล์แนบ

เฟสนี้ยังไม่ส่ง Email จริง, ยังไม่ส่ง LINE จริง และ OCR ยังเป็นสถานะ `not_run`

### StockInventory

แท็บ `StockInventory` ใช้เป็น cache สำหรับค้นหาทะเบียนรถเร็วบนมือถือ

หัวตารางคือ:

```text
Plate | Brand | Model | Year | Color | SalePrice | Source | Ownership | Project | Campaign | ImportedAt | UpdatedAt
```

ถ้ามีข้อมูลในแท็บนี้แล้ว ผู้ใช้กรอกทะเบียนในหน้า `/booking-reports` ระบบจะดึงข้อมูลรถมาเติมช่องที่ว่างให้อัตโนมัติ

## 8. วิธี Deploy Apps Script หลังอัปเดตเฟส 1

ต้อง deploy ใหม่ทุกครั้งหลังแก้ไฟล์ `google-apps-script/Code.gs`

1. เปิดโปรเจกต์ Apps Script เดิม
2. เปิดไฟล์ `Code.gs`
3. ลบโค้ดเดิมทั้งหมด
4. คัดลอกโค้ดล่าสุดจาก `google-apps-script/Code.gs` ไปวางแทน
5. กด Save
6. กด `Deploy` > `Manage deployments`
7. กดไอคอนดินสอของ Web App เดิม
8. ช่อง `Version` เลือก `New version`
9. Description ใส่ เช่น `Booking reports phase 1`
10. กด `Deploy`
11. ใช้ Web app URL เดิมต่อได้ ไม่ต้องเปลี่ยน `.env.local` หรือ Vercel env ถ้า URL เดิมไม่เปลี่ยน

หลัง deploy ให้ทดสอบ:

1. เปิด `https://script.google.com/macros/s/.../exec` ใน browser
2. ต้องเห็น `version` เป็น `2026-05-18-02`
3. เปิดเว็บ `/booking-reports`
4. กรอกชื่อผู้ซื้อ, ทะเบียน, Sale แล้วกด `บันทึก Draft`
5. กลับไปดู Google Sheet ต้องมีแท็บ `BookingReports` และมีข้อมูลแถวใหม่
