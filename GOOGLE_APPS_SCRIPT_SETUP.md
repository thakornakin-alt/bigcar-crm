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
