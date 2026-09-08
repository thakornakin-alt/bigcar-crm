import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  blankBookingFinanceSigning,
  autofillFinancePriceFromStock,
  calculateFinanceAmountBeforeVat,
  renderBookingFinanceSigningPreview
} from "../lib/booking-finance-signing.ts";

const root = new URL("../", import.meta.url);

test("finance amount follows editable finance price minus entered down payment without VAT", () => {
  assert.deepEqual(calculateFinanceAmountBeforeVat("389000", "50000"), { amount: 339000, error: "" });
  assert.deepEqual(calculateFinanceAmountBeforeVat("389000", "0"), { amount: 389000, error: "" });
  assert.equal(calculateFinanceAmountBeforeVat("389000", "500000").amount, null);
  assert.match(calculateFinanceAmountBeforeVat("389000", "500000").error, /มากกว่า/);
  assert.deepEqual(calculateFinanceAmountBeforeVat("", "0"), { amount: null, error: "กรุณาระบุราคารถสำหรับจัดไฟแนนซ์" });
  assert.equal(calculateFinanceAmountBeforeVat("", "").amount, null);
  assert.match(calculateFinanceAmountBeforeVat("not-a-price", "0").error, /เป็นตัวเลข/);
  assert.deepEqual(calculateFinanceAmountBeforeVat("350000", "50000"), { amount: 300000, error: "" });
});

test("Stock auto-fill is one-time and a manual finance price is never overwritten", () => {
  const auto = autofillFinancePriceFromStock(blankBookingFinanceSigning, "389,000");
  assert.equal(auto.financePrice, "389000");
  assert.equal(auto.financePriceSource, "stock");
  const manual = { ...auto, financePrice: "350000", financePriceSource: "manual" as const };
  assert.deepEqual(autofillFinancePriceFromStock(manual, "400000"), manual);
  assert.deepEqual(autofillFinancePriceFromStock({ ...blankBookingFinanceSigning, financePriceSource: "manual" }, "400000"), { ...blankBookingFinanceSigning, financePriceSource: "manual" });
});

test("finance preview reuses Booking, canonical owner and Stock values in the approved order", () => {
  const output = renderBookingFinanceSigningPreview({
    finance: {
      ...blankBookingFinanceSigning,
      financeCompany: "TISCO",
      signingLocation: "บางนา",
      occupation: "พนักงานบริษัท",
      employmentDuration: "5 ปี",
      income: "45000",
      creditStatus: "มี",
      financePrice: "389000",
      financePriceSource: "stock",
      downPayment: "50000"
    },
    customerName: "ลูกค้าทดสอบ",
    plate: "กก 1234",
    brand: "TOYOTA",
    model: "CAMRY",
    year: "2024",
    teamName: "พี่ลีฟ",
    owner: { firstName: "ฐากร", lastName: "อคิน", nickname: "บิ๊ก", branch: "สาขาบางนา" },
    fallbackSaleName: "ห้ามใช้",
    stockVehicle: { salePrice: "389000" }
  });
  const expected = [
    "ส่งงานเซ็นไฟแนนซ์", "ไฟแนนซ์ : TISCO", "สถานที่นัดเซ็น : บางนา",
    "ชื่อเซล : ฐากร (บิ๊ก)", "ทีม : พี่ลีฟ บางนา", "ชื่อลูกค้า : ลูกค้าทดสอบ",
    "อาชีพ : พนักงานบริษัท", "อายุงาน : 5 ปี", "รายได้ : 45,000", "ลูกค้ามีเครดิตหรือไม่ : มี",
    "ทะเบียนรถ : กก 1234", "ยี่ห้อรถ : TOYOTA", "รุ่น : CAMRY", "ปี : 2024",
    "ดีลเลอร์ : อาคเนย์แคปปิตอล", "ราคาขาย : 389,000", "เงินดาวน์ : 50,000",
    "ยอดจัด (ก่อน VAT) : 339,000", "ดอกเบี้ย : ปิดตามโปรไฟล์ลูกค้า",
    "จำนวนงวด : ปิดตามหน้างาน", "ประกันภัยรถยนต์ : ปิดตามหน้างาน"
  ];
  let cursor = -1;
  for (const value of expected) {
    const next = output.indexOf(value);
    assert.ok(next > cursor, `${value} must be in approved order`);
    cursor = next;
  }
});

test("missing finance price stays blank and never falls back to finalPrice or zero", () => {
  const output = renderBookingFinanceSigningPreview({
    finance: { ...blankBookingFinanceSigning, downPayment: "10000" },
    customerName: "", plate: "", brand: "", model: "", year: "", teamName: "", owner: null,
    fallbackSaleName: "", stockVehicle: null
  });
  assert.match(output, /ราคาขาย :\s*\n/);
  assert.match(output, /ยอดจัด \(ก่อน VAT\) : กรุณาระบุราคารถสำหรับจัดไฟแนนซ์/);
  assert.doesNotMatch(output, /finalPrice|1\.07|ยอดจัด \(ก่อน VAT\) : 0/);
});

test("Booking UI gates eight inputs and preview on existing finance payment mode", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /paymentMode === "finance"/);
  for (const label of ["ไฟแนนซ์", "สถานที่นัดเซ็น", "อาชีพ", "อายุงาน", "รายได้", "ลูกค้ามีเครดิตหรือไม่", "ราคารถสำหรับจัดไฟแนนซ์", "เงินดาวน์"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /Preview ส่งงานเซ็นไฟแนนซ์/);
  assert.match(page, /stockVehicle\?\.salePrice/);
  assert.doesNotMatch(page, /calculateFinanceAmountBeforeVat\(form\.finalPrice/);
});

test("finance metadata is keyed by stable bookingReportId and canonical Stock lookup", async () => {
  const store = await readFile(new URL("../lib/booking-finance-metadata.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/booking-reports/finance-signing/route.ts", import.meta.url), "utf8");
  assert.match(store, /records\[record\.bookingReportId\]/);
  assert.doesNotMatch(store, /records\[record\.stockPlate\]|records\[.*customer/);
  assert.match(route, /getCaseOwnership\("booking", bookingReportId\)/);
  assert.match(route, /reports\.find\(\(report\) => report\.id === bookingReportId\)/);
  assert.match(route, /lookupStockByPlateDetailed\(booking\.plate\)/);
  assert.match(route, /const stockPrice = clean\(stock\.vehicle\?\.salePrice\) \|\| clean\(existingMetadata\?\.stockPrice\)/);
  assert.match(route, /financePriceSource/);
  assert.doesNotMatch(route, /body\.finalPrice|body\.salePrice/);
});

test("cash path remains free of finance preview and sidecar writes", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(payload\.paymentType\.includes\("ไฟแนนซ์"\) \|\| payload\.paymentType\.toLowerCase\(\)\.includes\("finance"\)\)/);
  const appsScriptDiff = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  assert.ok(appsScriptDiff.length > 0);
});
