import type { InstallmentRow, InterestRate } from "@/lib/types";

export const CALCULATOR_EXPORT_WIDTH = 1080;
export const CALCULATOR_EXPORT_HEIGHT = 1600;

export type CalculatorQuoteProfile = {
  nickname: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  lineId: string;
  lineQrUrl: string;
  branch: string;
};

export type CalculatorQuoteModel = {
  carModel: string;
  actualYear: string;
  carColor: string;
  mileage: string;
  carPrice: number;
  rate: InterestRate;
  rows: InstallmentRow[];
  selectedDownLabel: string;
  selectedTermKey: "months48" | "months60" | "months72" | "months84";
  profile: CalculatorQuoteProfile;
};

type QuoteAssets = { avatar: HTMLImageElement | null; lineQr: HTMLImageElement | null };

const terms = [
  { key: "months48", months: 48, label: "48 งวด" },
  { key: "months60", months: 60, label: "60 งวด" },
  { key: "months72", months: 72, label: "72 งวด" },
  { key: "months84", months: 84, label: "84 งวด" }
] as const;

export type CalculatorQuoteGridColumnKey = "down" | "downPayment" | "financeAmount" | (typeof terms)[number]["key"];

export type CalculatorQuoteGridCell = {
  key: CalculatorQuoteGridColumnKey;
  x: number;
  width: number;
  left: number;
  right: number;
  center: number;
};

export type CalculatorQuoteGrid = {
  x: number;
  y: number;
  width: number;
  headerHeight: number;
  rowHeight: number;
  height: number;
  columns: CalculatorQuoteGridCell[];
};

const GRID_COLUMN_SPECS: ReadonlyArray<{ key: CalculatorQuoteGridColumnKey; baseWidth: number }> = [
  { key: "down", baseWidth: 120 },
  { key: "downPayment", baseWidth: 160 },
  { key: "financeAmount", baseWidth: 160 },
  { key: "months48", baseWidth: 136 },
  { key: "months60", baseWidth: 136 },
  { key: "months72", baseWidth: 136 },
  { key: "months84", baseWidth: 136 }
];

const GRID_BASE_WIDTH = GRID_COLUMN_SPECS.reduce((sum, column) => sum + column.baseWidth, 0);

export function createCalculatorQuoteGrid(rowCount: number): CalculatorQuoteGrid {
  const x = 48;
  const y = 538;
  const width = GRID_BASE_WIDTH;
  const headerHeight = 72;
  const rowHeight = 54;
  let cursor = x;
  const columns = GRID_COLUMN_SPECS.map((spec) => {
    const left = cursor;
    const right = left + spec.baseWidth;
    cursor = right;
    return { key: spec.key, x: left, width: right - left, left, right, center: left + (right - left) / 2 };
  });
  return { x, y, width, headerHeight, rowHeight, height: headerHeight + rowHeight * rowCount, columns };
}

export async function loadCalculatorQuoteAssets(profile: CalculatorQuoteProfile): Promise<QuoteAssets> {
  const [avatar, lineQr] = await Promise.all([
    profile.avatarUrl ? loadCanvasImage(profile.avatarUrl).catch(() => null) : Promise.resolve(null),
    profile.lineQrUrl ? loadCanvasImage(profile.lineQrUrl).catch(() => null) : Promise.resolve(null)
  ]);
  return { avatar, lineQr };
}

export function drawCalculatorQuote(
  canvas: HTMLCanvasElement,
  model: CalculatorQuoteModel,
  assets: QuoteAssets,
  scale = 1
) {
  canvas.width = CALCULATOR_EXPORT_WIDTH * scale;
  canvas.height = CALCULATOR_EXPORT_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถสร้างรูปได้บนอุปกรณ์นี้");
  ctx.scale(scale, scale);

  const selectedRow = model.rows.find((row) => row.label === model.selectedDownLabel) || model.rows[0];
  const selectedTerm = terms.find((term) => term.key === model.selectedTermKey) || terms[3];
  const selectedPayment = selectedRow?.payments[model.selectedTermKey] || 0;
  const selectedInterestRate = model.rate[model.selectedTermKey];
  const hasVehicleTitle = Boolean(model.carModel.trim());

  const gradient = ctx.createLinearGradient(0, 0, CALCULATOR_EXPORT_WIDTH, CALCULATOR_EXPORT_HEIGHT);
  gradient.addColorStop(0, "#171719");
  gradient.addColorStop(0.58, "#252127");
  gradient.addColorStop(1, "#171719");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CALCULATOR_EXPORT_WIDTH, CALCULATOR_EXPORT_HEIGHT);
  ctx.fillStyle = "#8f2637";
  ctx.fillRect(0, 0, 18, CALCULATOR_EXPORT_HEIGHT);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px Arial, sans-serif";
  ctx.fillText("BIG CAR", 64, 78);
  ctx.fillStyle = "#c9a56a";
  ctx.font = "700 15px Arial, sans-serif";
  ctx.fillText("USED CAR • TRUSTED SERVICE", 66, 105);
  ctx.textAlign = "right";
  ctx.fillStyle = "#aeb0b5";
  ctx.font = "600 18px Arial, sans-serif";
  ctx.fillText("ข้อเสนอค่างวด", 1016, 82);
  ctx.textAlign = "left";

  card(ctx, 48, 138, 984, 288, 26, "#faf8f5");
  ctx.fillStyle = "#8f2637";
  ctx.font = "800 18px Arial, sans-serif";
  ctx.fillText("รถคันที่คุณสนใจ", 80, 184);
  ctx.fillStyle = "#171719";
  const vehicleTitle = hasVehicleTitle ? model.carModel.trim() : "คำนวณค่างวดเบื้องต้น";
  fitTextAtSize(ctx, vehicleTitle, 80, 238, 610, 42, 29);
  ctx.fillStyle = "#565158";
  ctx.font = "700 21px Arial, sans-serif";
  const vehicleDetail = hasVehicleTitle
    ? [model.actualYear && `ปี ${model.actualYear}`, model.carColor, model.mileage].filter(Boolean).join("  •  ")
    : "อ้างอิงจากราคารถที่ระบุ";
  fitText(ctx, vehicleDetail || "รายละเอียดรถตามข้อมูลที่กรอก", 80, 278, 610);
  ctx.fillStyle = "#8f2637";
  ctx.font = "700 17px Arial, sans-serif";
  ctx.fillText("ราคารถ", 80, 338);
  ctx.fillStyle = "#171719";
  ctx.font = "900 46px Arial, sans-serif";
  ctx.fillText(`${wholeMoney(model.carPrice)} บาท`, 80, 388);

  ctx.fillStyle = "#f1ece6";
  roundRect(ctx, 728, 172, 264, 218, 22);
  ctx.fill();
  ctx.fillStyle = "#741f2c";
  ctx.font = "800 17px Arial, sans-serif";
  ctx.fillText("ผ่อนเริ่มต้น", 756, 210);
  ctx.fillStyle = "#8f2637";
  ctx.font = "900 43px Arial, sans-serif";
  ctx.fillText(`${wholeMoney(selectedPayment)}`, 756, 270);
  ctx.fillStyle = "#171719";
  ctx.font = "900 21px Arial, sans-serif";
  ctx.fillText("บาท/เดือน", 756, 303);
  ctx.fillStyle = "#5d5860";
  ctx.font = "700 17px Arial, sans-serif";
  ctx.fillText(`ดาวน์ ${selectedRow?.label || "-"} · ${selectedTerm.months} งวด`, 756, 335);
  ctx.font = "700 14px Arial, sans-serif";
  ctx.fillText(`ดอกเบี้ย ${formatInterestRate(selectedInterestRate)} ต่อปี`, 756, 359);
  ctx.font = "600 14px Arial, sans-serif";
  ctx.fillText(`เงินดาวน์ ${wholeMoney(selectedRow?.downPayment || 0)} บาท`, 756, 382);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 25px Arial, sans-serif";
  ctx.fillText("เปรียบเทียบค่างวด", 56, 478);
  ctx.fillStyle = "#aeb0b5";
  ctx.font = "600 16px Arial, sans-serif";
  ctx.fillText("แตะเลือกแผนบนหน้าเครื่องคิดเลขก่อนบันทึกรูป", 56, 507);

  drawInstallmentGrid(ctx, model);

  const profileTop = 1250;
  card(ctx, 48, profileTop, 984, 236, 24, "#faf8f5");
  ctx.fillStyle = "#8f2637";
  ctx.font = "800 16px Arial, sans-serif";
  ctx.fillText("สอบถามรายละเอียดและนัดดูรถ", 80, profileTop + 40);
  drawAvatar(ctx, assets.avatar, model.profile, 80, profileTop + 66, 110);
  ctx.fillStyle = "#171719";
  ctx.font = "900 29px Arial, sans-serif";
  ctx.fillText(model.profile.nickname || model.profile.fullName || "ทีมขาย BIG CAR", 214, profileTop + 94);
  ctx.fillStyle = "#565158";
  ctx.font = "700 17px Arial, sans-serif";
  if (model.profile.fullName && model.profile.fullName !== model.profile.nickname) {
    fitText(ctx, model.profile.fullName, 214, profileTop + 124, 420);
  }
  ctx.fillStyle = "#8f2637";
  ctx.font = "900 25px Arial, sans-serif";
  ctx.fillText(`โทร. ${model.profile.phone || "-"}`, 214, profileTop + 164);
  ctx.fillStyle = "#4f4b51";
  ctx.font = "700 17px Arial, sans-serif";
  const lineAndBranch = [model.profile.lineId && `LINE: ${model.profile.lineId}`, model.profile.branch]
    .filter(Boolean)
    .join("  •  ");
  fitText(ctx, lineAndBranch || "ติดต่อทีมขาย BIG CAR", 214, profileTop + 194, 520);
  if (assets.lineQr) {
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 824, profileTop + 44, 164, 164, 18);
    ctx.fill();
    drawImageContain(ctx, assets.lineQr, 836, profileTop + 56, 140, 140);
  }

  ctx.fillStyle = "#969298";
  ctx.font = "600 14px Arial, sans-serif";
  ctx.fillText("ค่างวดเป็นการประมาณการ อัตราและผลอนุมัติขึ้นอยู่กับเงื่อนไขของสถาบันการเงิน", 56, 1536);
  ctx.fillStyle = "#c9a56a";
  ctx.font = "800 15px Arial, sans-serif";
  ctx.fillText("BIG CAR", 56, 1570);
}

function drawInstallmentGrid(ctx: CanvasRenderingContext2D, model: CalculatorQuoteModel) {
  const grid = createCalculatorQuoteGrid(model.rows.length);
  const [downCell, downPaymentCell, financeCell, ...termCells] = grid.columns;

  card(ctx, grid.x, grid.y, grid.width, grid.height, 22, "#222226");
  ctx.save();
  roundRect(ctx, grid.x, grid.y, grid.width, grid.height, 22);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#303036";
  ctx.fillRect(grid.x, grid.y, grid.width, grid.headerHeight);

  ctx.fillStyle = "#d8d8dc";
  ctx.font = "700 16px Arial, sans-serif";
  const headerCenterY = grid.y + grid.headerHeight / 2;
  drawGridText(ctx, downCell, "ดาวน์", headerCenterY);
  drawGridText(ctx, downPaymentCell, "เงินดาวน์", headerCenterY);
  drawGridText(ctx, financeCell, "ยอดจัด", headerCenterY);
  terms.forEach((term, termIndex) => {
    const cell = termCells[termIndex];
    drawGridText(ctx, cell, term.label, grid.y + 26);
    ctx.fillStyle = "#d6b66c";
    ctx.font = "700 13px Arial, sans-serif";
    drawGridText(ctx, cell, `ดอก ${formatInterestRate(model.rate[term.key])}`, grid.y + 50);
    ctx.fillStyle = "#d8d8dc";
    ctx.font = "700 16px Arial, sans-serif";
  });

  model.rows.forEach((row, rowIndex) => {
    const rowTop = grid.y + grid.headerHeight + rowIndex * grid.rowHeight;
    const rowCenterY = rowTop + grid.rowHeight / 2;
    const selected = row.label === model.selectedDownLabel;
    ctx.fillStyle = selected ? "#4b222b" : rowIndex % 2 === 0 ? "#26262a" : "#202024";
    ctx.fillRect(grid.x, rowTop, grid.width, grid.rowHeight);
    if (selected) {
      ctx.fillStyle = "#d6b66c";
      ctx.fillRect(grid.x, rowTop, 5, grid.rowHeight);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = selected ? "800 17px Arial, sans-serif" : "700 17px Arial, sans-serif";
    drawGridText(ctx, downCell, row.label, rowCenterY);
    drawGridText(ctx, downPaymentCell, wholeMoney(row.downPayment), rowCenterY);
    ctx.fillStyle = "#c8c7cb";
    drawGridText(ctx, financeCell, wholeMoney(row.financeAmount), rowCenterY);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 17px Arial, sans-serif";
    terms.forEach((term, termIndex) => {
      drawGridText(ctx, termCells[termIndex], payment(row.payments[term.key]), rowCenterY);
    });
  });

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  grid.columns.slice(1).forEach((cell) => {
    ctx.moveTo(cell.left + 0.5, grid.y);
    ctx.lineTo(cell.left + 0.5, grid.y + grid.height);
  });
  for (let rowBoundary = 0; rowBoundary <= model.rows.length; rowBoundary += 1) {
    const boundaryY = grid.y + grid.headerHeight + rowBoundary * grid.rowHeight + 0.5;
    ctx.moveTo(grid.x, boundaryY);
    ctx.lineTo(grid.x + grid.width, boundaryY);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  roundRect(ctx, grid.x + 0.5, grid.y + 0.5, grid.width - 1, grid.height - 1, 22);
  ctx.stroke();
  ctx.restore();
}

function drawGridText(
  ctx: CanvasRenderingContext2D,
  cell: CalculatorQuoteGridCell,
  text: string,
  centerY: number
) {
  ctx.fillText(text, cell.center, centerY);
}

function drawAvatar(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, profile: CalculatorQuoteProfile, x: number, y: number, size: number) {
  ctx.save();
  roundRect(ctx, x, y, size, size, size / 2);
  ctx.clip();
  ctx.fillStyle = "#8f2637";
  ctx.fillRect(x, y, size, size);
  if (image) drawImageCover(ctx, image, x, y, size, size);
  else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(initials(profile), x + size / 2, y + size / 2 + 12);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function initials(profile: CalculatorQuoteProfile) {
  const value = profile.nickname || profile.fullName || "BC";
  return Array.from(value.replace(/\s+/g, "")).slice(0, 2).join("").toUpperCase();
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
    image.src = src;
  });
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return ctx.fillText(text, x, y);
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
  ctx.fillText(`${clipped}…`, x, y);
}

function fitTextAtSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
) {
  let fontSize = preferredSize;
  ctx.font = `900 ${fontSize}px Arial, sans-serif`;
  while (fontSize > minimumSize && ctx.measureText(text).width > maxWidth) {
    fontSize -= 1;
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
  }
  fitText(ctx, text, x, y, maxWidth);
}

function drawImageContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const ratio = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const ratio = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wholeMoney(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

function payment(value: number) {
  return value ? wholeMoney(value) : "-";
}

function formatInterestRate(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(2)}%`;
}
