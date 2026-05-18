# Big Car CRM

ระบบบันทึกลูกค้าสำหรับธุรกิจขายรถมือสอง เน้นเปิดไว จดไว ค้นหาง่าย และใช้งานบนมือถือเป็นหลัก

## Tech Stack

- Next.js
- Tailwind CSS
- Google Apps Script Web App
- Vercel ready

## Google Sheet + Apps Script Setup

1. สร้าง Google Sheet ใหม่
2. ตั้งชื่อแท็บเป็น `Customers`
3. ใส่หัวตารางแถวแรก:

```text
No | Date | Car | Name | Phone | Note
```

4. เปิด [script.google.com](https://script.google.com)
5. สร้าง Apps Script project ใหม่
6. วางโค้ดจาก `google-apps-script/Code.gs`
7. Deploy เป็น Web App โดยตั้งค่า `Execute as: Me` และ `Who has access: Anyone`
8. คัดลอก Web App URL มาใส่ใน `.env.local`

ดูขั้นตอนละเอียดได้ที่ `GOOGLE_APPS_SCRIPT_SETUP.md`

## Environment Variables

สร้างไฟล์ `.env.local` โดยดูตัวอย่างจาก `.env.example`

```bash
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SHEET_NAME=Customers
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your-deployment-id/exec
```

ตำแหน่ง `GOOGLE_SHEET_ID` คือค่าระหว่าง `/d/` และ `/edit` ใน URL ของ Google Sheet

## Run Project

```bash
npm install
npm run dev
```

เปิดใช้งานที่:

```text
http://localhost:3000
```

## Deploy on Vercel

1. Push โปรเจกต์ขึ้น GitHub
2. Import เข้า Vercel
3. ใส่ Environment Variables ทั้ง 3 ค่าใน Vercel
4. Deploy

## Features

- เพิ่มลูกค้า: Car, Name, Phone, Note
- คำนวณค่างวดรถมือสองจากตารางดอกเบี้ยใน Google Sheet
- สร้างรายงานจองแบบ Draft / Preview ที่ `/booking-reports`
- สร้างรายงานขายจากรายงานจองเดิมที่ `/sales-reports`
- บันทึกรายงานจองลงแท็บ `BookingReports` โดยไม่กระทบแท็บลูกค้าเดิม
- Import stock จาก Excel/CSV ที่ `/stock-import` ลงแท็บ `StockInventory`
- ค้นทะเบียนจาก stock เพื่อเติมข้อมูลรถในรายงานจอง
- สร้าง Running Number อัตโนมัติ
- ใส่วันที่อัตโนมัติ
- บันทึกลง Google Sheet
- แสดงรายการล่าสุดอยู่บนสุด
- ค้นหาจากชื่อ รุ่นรถ หรือเบอร์โทร
- ดูรายละเอียดลูกค้า
- แก้ไขข้อมูล
- ลบข้อมูลจาก Google Sheet
- Mobile-first dark mode UI
