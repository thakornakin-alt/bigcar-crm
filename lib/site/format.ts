export function formatBaht(value: number) {
  return `${value.toLocaleString("th-TH")} บาท`;
}

export function formatMileage(value: number) {
  return `${value.toLocaleString("th-TH")} กม.`;
}

export function maskVin(value: string) {
  if (!value) return "-";
  if (value.length <= 8) return value;
  return `${value.slice(0, 6)}••••••${value.slice(-4)}`;
}

export function statusLabel(status: string) {
  if (status === "available") return "พร้อมขาย";
  if (status === "reserved") return "จองแล้ว";
  if (status === "sold") return "ขายแล้ว";
  return "ซ่อน";
}
