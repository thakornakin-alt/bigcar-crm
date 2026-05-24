"use client";

import { ArrowLeft, Calculator, Car, ImageDown, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader, TopMenuButton } from "@/app/components/ui";
import { useSalesProfile } from "@/lib/use-sales-profile";
import type { InstallmentRow, InterestRate } from "@/lib/types";

const vehicleTypes = ["รถเก๋ง/กระบะ 4 ประตู", "รถกระบะ/รถตู้"];
const downRates = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
const defaultInterestRates: InterestRate[] = [
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2022-2026", months48: 0.0279, months60: 0.0309, months72: 0.0399, months84: 0.0449, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2020-2021", months48: 0.0299, months60: 0.0319, months72: 0.0419, months84: 0.0449, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2019", months48: 0.0299, months60: 0.0349, months72: 0.0429, months84: 0.0499, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2017-2018", months48: 0.0339, months60: 0.0379, months72: 0.0459, months84: 0.0539, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2016", months48: 0.058, months60: 0.0635, months72: 0.0745, months84: 0.0795, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2015", months48: 0.061, months60: 0.071, months72: 0.077, months84: 0.0795, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2014", months48: 0.071, months60: 0.0735, months72: 0.0795, months84: null, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2013", months48: 0.0735, months60: 0.076, months72: 0.0795, months84: null, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2012", months48: 0.076, months60: 0.0785, months72: null, months84: null, commission: 0.08 },
  { vehicleType: "รถเก๋ง/กระบะ 4 ประตู", yearRange: "2011", months48: 0.0785, months60: 0.081, months72: null, months84: null, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2022-2026", months48: 0.0369, months60: 0.0389, months72: 0.0479, months84: 0.0524, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2020-2021", months48: 0.0374, months60: 0.0394, months72: 0.0494, months84: 0.0524, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2019", months48: 0.0399, months60: 0.0449, months72: 0.0529, months84: 0.0599, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2017-2018", months48: 0.0459, months60: 0.0529, months72: 0.0599, months84: 0.0699, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2016", months48: 0.065, months60: 0.0735, months72: 0.0795, months84: 0.0795, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2015", months48: 0.068, months60: 0.076, months72: 0.0795, months84: 0.0795, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2014", months48: 0.072, months60: 0.0785, months72: 0.0795, months84: null, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2013", months48: 0.077, months60: 0.0785, months72: 0.0795, months84: null, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2012", months48: 0.0785, months60: 0.0785, months72: null, months84: null, commission: 0.08 },
  { vehicleType: "รถกระบะ/รถตู้", yearRange: "2011", months48: 0.0835, months60: 0.0835, months72: null, months84: null, commission: 0.08 }
];
const terms = [
  { key: "months48", months: 48, years: 4, label: "48" },
  { key: "months60", months: 60, years: 5, label: "60" },
  { key: "months72", months: 72, years: 6, label: "72" },
  { key: "months84", months: 84, years: 7, label: "84" }
] as const;

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function parseMoney(value: string) {
  return Number(value.replace(/,/g, "")) || 0;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatWholeMoney(value: number) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

function calculatePayment(financeAmount: number, rate: number | null, months: number, years: number) {
  if (!rate || financeAmount <= 0) return null;
  return roundCurrency(((financeAmount * rate * years + financeAmount) / months) * 1.07);
}

export default function CalculatorPage() {
  const { user: salesProfile } = useSalesProfile();
  const [rates, setRates] = useState<InterestRate[]>(defaultInterestRates);
  const [rateSource, setRateSource] = useState<"default" | "sheet">("default");
  const [vehicleType, setVehicleType] = useState(vehicleTypes[0]);
  const [yearRange, setYearRange] = useState("2022-2026");
  const [carModel, setCarModel] = useState("");
  const [actualYear, setActualYear] = useState("");
  const [carPrice, setCarPrice] = useState("684000");
  const [specialDownPayment, setSpecialDownPayment] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function loadRates() {
    setError("");
    const data = await api<{ rates: InterestRate[] }>("/api/finance/rates");
    if (!data.rates.length) {
      setRates(defaultInterestRates);
      setRateSource("default");
      setError("ยังไม่พบแท็บ InterestRates ใน Google Sheet จึงใช้ดอกเบี้ยตั้งต้นจาก Excel");
      return;
    }
    setRates(data.rates);
    setRateSource("sheet");
  }

  useEffect(() => {
    loadRates()
      .catch(() => {
        setRates(defaultInterestRates);
        setRateSource("default");
        setError("โหลดดอกเบี้ยจาก Google Sheet ไม่ได้ จึงใช้ดอกเบี้ยตั้งต้นจาก Excel");
      })
      .finally(() => setLoading(false));
  }, []);

  const yearOptions = useMemo(() => {
    const values = rates
      .filter((rate) => rate.vehicleType === vehicleType)
      .map((rate) => rate.yearRange);
    return Array.from(new Set(values));
  }, [rates, vehicleType]);

  useEffect(() => {
    if (yearOptions.length && !yearOptions.includes(yearRange)) {
      setYearRange(yearOptions[0]);
    }
  }, [yearOptions, yearRange]);

  const selectedRate = useMemo(
    () => rates.find((rate) => rate.vehicleType === vehicleType && rate.yearRange === yearRange) || null,
    [rates, vehicleType, yearRange]
  );

  const price = parseMoney(carPrice);
  const customDown = parseMoney(specialDownPayment);

  const rows = useMemo<InstallmentRow[]>(() => {
    if (!selectedRate || price <= 0) return [];

    const baseRows = downRates.map((downRate) => {
      const downPayment = roundCurrency(price * downRate);
      return buildRow(`${Math.round(downRate * 100)}%`, downRate, downPayment, price, selectedRate);
    });

    if (customDown > 0) {
      baseRows.push(buildRow("กำหนดเอง", null, Math.min(customDown, price), price, selectedRate));
    }

    return baseRows;
  }, [customDown, price, selectedRate]);

  async function handleSaveImage() {
    if (!rows.length || !selectedRate) return;

    setExporting(true);
    setError("");

    try {
      await exportInstallmentImage({
        carModel,
        actualYear,
        carPrice: price,
        rate: selectedRate,
        rows,
        contactName: salesProfile?.nickname || salesProfile?.firstName || "บิ๊ก",
        contactPhone: salesProfile?.phone || "091-778-5117",
        contactLineId: salesProfile?.lineId || "@bigcars",
        contactAvatarUrl: salesProfile?.avatarUrl || "",
        contactLineQrUrl: salesProfile?.lineQrUrl || ""
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกรูปไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <AppHeader
        title="คำนวณค่างวด"
        subtitle={salesProfile ? `ใช้โปรไฟล์เซลล์: ${salesProfile.nickname}` : "ยังไม่ได้ Login จะใช้ข้อมูลบิ๊กเป็นค่าเริ่มต้น"}
        actions={
          <TopMenuButton href="/" icon={<ArrowLeft size={18} />}>
            ลูกค้า
          </TopMenuButton>
        }
      />

      <section className="mb-4 rounded-lg border border-line bg-panel p-4 shadow-glow">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="รุ่นรถ" value={carModel} onChange={setCarModel} placeholder="Toyota Revo 2020" />
          <TextField label="ปีรถ" value={actualYear} onChange={setActualYear} placeholder="2020" inputMode="numeric" />
          <SelectField label="ประเภทรถ" value={vehicleType} onChange={setVehicleType} options={vehicleTypes} />
          <SelectField label="ช่วงปีรถ" value={yearRange} onChange={setYearRange} options={yearOptions} />
          <NumberField label="ราคารถ" value={carPrice} onChange={setCarPrice} placeholder="684000" />
          <NumberField
            label="เงินดาวน์กำหนดเอง"
            value={specialDownPayment}
            onChange={setSpecialDownPayment}
            placeholder="เช่น 50000"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-soft">
          <span className="flex items-center gap-2">
            <Car size={16} className="text-brand" aria-hidden="true" />
            {selectedRate
              ? rateSource === "sheet"
                ? "ใช้ดอกเบี้ยจาก Google Sheet"
                : "ใช้ดอกเบี้ยตั้งต้นจาก Excel"
              : "ไม่พบตารางดอกเบี้ยสำหรับตัวเลือกนี้"}
          </span>
          {salesProfile && (
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              Export: {salesProfile.nickname}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadRates()
                .catch(() => {
                  setRates(defaultInterestRates);
                  setRateSource("default");
                  setError("โหลดดอกเบี้ยจาก Google Sheet ไม่ได้ จึงใช้ดอกเบี้ยตั้งต้นจาก Excel");
                })
                .finally(() => setLoading(false));
            }}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 font-semibold text-white"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-line bg-panel shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-white">ตารางผ่อน</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
              <span>รุ่นรถ: {carModel.trim()}</span>
              <span>ปีรถ: {actualYear.trim()}</span>
            </div>
          </div>
          {rows.length ? (
            <button
              type="button"
              disabled={exporting}
              onClick={handleSaveImage}
              className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-bold text-ink"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <ImageDown size={18} />}
              บันทึกรูป
            </button>
          ) : (
            <Calculator size={24} className="shrink-0 text-brand" aria-hidden="true" />
          )}
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-soft">
                  <th className="px-4 py-3 font-semibold">เรทดาวน์</th>
                  <th className="px-4 py-3 text-right font-semibold">เงินดาวน์</th>
                  <th className="px-4 py-3 text-right font-semibold">ยอดจัด</th>
                  <PaymentHeader label="48 งวด" rate={selectedRate?.months48 || null} />
                  <PaymentHeader label="60 งวด" rate={selectedRate?.months60 || null} />
                  <PaymentHeader label="72 งวด" rate={selectedRate?.months72 || null} />
                  <PaymentHeader label="84 งวด" rate={selectedRate?.months84 || null} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.label}-${row.downPayment}`} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-bold text-white">{row.label}</td>
                    <td className="px-4 py-3 text-right text-[#dce2eb]">{formatMoney(row.downPayment)}</td>
                    <td className="px-4 py-3 text-right text-[#dce2eb]">{formatMoney(row.financeAmount)}</td>
                    <PaymentCell value={row.payments.months48} />
                    <PaymentCell value={row.payments.months60} />
                    <PaymentCell value={row.payments.months72} />
                    <PaymentCell value={row.payments.months84} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loading ? (
          <div className="flex min-h-36 items-center justify-center text-soft">
            <Loader2 size={22} className="mr-2 animate-spin" />
            Loading
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-soft">กรอกราคารถและเลือกตารางดอกเบี้ย</div>
        )}
      </section>
    </main>
  );
}

function buildRow(
  label: string,
  downRate: number | null,
  downPayment: number,
  price: number,
  rate: InterestRate
): InstallmentRow {
  const financeAmount = Math.max(roundCurrency(price - downPayment), 0);

  return {
    label,
    downRate,
    downPayment,
    financeAmount,
    payments: {
      months48: calculatePayment(financeAmount, rate.months48, 48, 4) || 0,
      months60: calculatePayment(financeAmount, rate.months60, 60, 5) || 0,
      months72: calculatePayment(financeAmount, rate.months72, 72, 6) || 0,
      months84: calculatePayment(financeAmount, rate.months84, 84, 7) || 0
    }
  };
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none focus:border-brand"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "text" | "numeric";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-12 w-full rounded-lg border border-line bg-[#0b0d11] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}

function PaymentHeader({ label, rate }: { label: string; rate: number | null }) {
  return (
    <th className="px-4 py-3 text-right font-semibold">
      <span className="block text-[#dce2eb]">{label}</span>
      <span className="mt-1 block text-xs text-brand">{formatPercent(rate)}</span>
    </th>
  );
}

function PaymentCell({ value }: { value: number }) {
  return (
    <td className="px-4 py-3 text-right font-bold text-brand">
      {value ? formatWholeMoney(value) : "-"}
    </td>
  );
}

async function exportInstallmentImage({
  carModel,
  actualYear,
  carPrice,
  rate,
  rows,
  contactName,
  contactPhone,
  contactLineId,
  contactAvatarUrl,
  contactLineQrUrl
}: {
  carModel: string;
  actualYear: string;
  carPrice: number;
  rate: InterestRate;
  rows: InstallmentRow[];
  contactName: string;
  contactPhone: string;
  contactLineId: string;
  contactAvatarUrl: string;
  contactLineQrUrl: string;
}) {
  const profileImage = await loadCanvasImage(contactAvatarUrl || "/big-profile.png").catch(() => null);
  const lineQrImage = contactLineQrUrl ? await loadCanvasImage(contactLineQrUrl).catch(() => null) : null;
  const canvas = document.createElement("canvas");
  const scale = Math.max(window.devicePixelRatio || 1, 2);
  const width = 1100;
  const rowHeight = 60;
  const tableHeaderHeight = 74;
  const headerHeight = 300;
  const footerHeight = 42;
  const height = headerHeight + tableHeaderHeight + rowHeight * rows.length + footerHeight;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถสร้างรูปได้บนอุปกรณ์นี้");

  ctx.scale(scale, scale);
  ctx.fillStyle = "#08090b";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#111318";
  roundRect(ctx, 28, 28, width - 56, height - 56, 18);
  ctx.fill();

  if (profileImage) {
    const sourceHeight = profileImage.height * 0.72;
    const imageHeight = 258;
    const imageWidth = Math.round((profileImage.width / sourceHeight) * imageHeight);
    ctx.drawImage(
      profileImage,
      0,
      0,
      profileImage.width,
      sourceHeight,
      width - imageWidth - 52,
      28,
      imageWidth,
      imageHeight
    );
  }

  if (lineQrImage) {
    const qrSize = 112;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, width - qrSize - 70, 162, qrSize + 20, qrSize + 20, 16);
    ctx.fill();
    ctx.drawImage(lineQrImage, width - qrSize - 60, 172, qrSize, qrSize);
    ctx.fillStyle = "#dce2eb";
    ctx.font = "700 16px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("สแกน LINE", width - qrSize / 2 - 60, 306);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 46px Arial, sans-serif";
  ctx.fillText("Big Car RDD", 56, 82);

  ctx.fillStyle = "#22c55e";
  ctx.font = "700 28px Arial, sans-serif";
  ctx.fillText(`${contactName || "บิ๊ก"} ${contactPhone || "091-778-5117"}`, 56, 124);
  ctx.fillText(`Line: ${contactLineId || "@bigcars"}`, 56, 162);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText("ตารางค่างวดรถมือสอง", 56, 214);

  ctx.fillStyle = "#aeb5c2";
  ctx.font = "24px Arial, sans-serif";
  ctx.fillText(`รุ่นรถ: ${carModel.trim() || "-"}`, 56, 254);
  ctx.fillText(`ปีรถ: ${actualYear.trim() || "-"}`, 360, 254);
  ctx.fillText(`ราคารถ ${formatWholeMoney(carPrice)} บาท`, 560, 254);

  const columns = [
    { label: "เรทดาวน์", rate: "", x: 56, width: 128, align: "left" },
    { label: "เงินดาวน์", rate: "", x: 190, width: 142, align: "right" },
    { label: "ยอดจัด", rate: "", x: 346, width: 142, align: "right" },
    { label: "48 งวด", rate: formatPercent(rate.months48), x: 518, width: 118, align: "right" },
    { label: "60 งวด", rate: formatPercent(rate.months60), x: 650, width: 118, align: "right" },
    { label: "72 งวด", rate: formatPercent(rate.months72), x: 782, width: 118, align: "right" },
    { label: "84 งวด", rate: formatPercent(rate.months84), x: 914, width: 118, align: "right" }
  ] as const;

  const tableTop = 300;
  ctx.fillStyle = "#1b2028";
  roundRect(ctx, 44, tableTop - 10, width - 88, tableHeaderHeight, 10);
  ctx.fill();

  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillStyle = "#dce2eb";
  columns.forEach((column) => {
    drawCellText(ctx, column.label, column.x, tableTop + 24, column.width, column.align);
    if (column.rate) {
      ctx.font = "700 18px Arial, sans-serif";
      ctx.fillStyle = "#22c55e";
      drawCellText(ctx, column.rate, column.x, tableTop + 50, column.width, column.align);
      ctx.font = "700 22px Arial, sans-serif";
      ctx.fillStyle = "#dce2eb";
    }
  });

  rows.forEach((row, index) => {
    const y = tableTop + tableHeaderHeight + rowHeight * index;
    ctx.fillStyle = index % 2 === 0 ? "#111318" : "#0d0f13";
    ctx.fillRect(44, y - 10, width - 88, rowHeight);
    ctx.fillStyle = "#252932";
    ctx.fillRect(44, y + rowHeight - 11, width - 88, 1);

    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    drawCellText(ctx, row.label, columns[0].x, y + 26, columns[0].width, "left");

    ctx.font = "22px Arial, sans-serif";
    ctx.fillStyle = "#dce2eb";
    drawCellText(ctx, formatWholeMoney(row.downPayment), columns[1].x, y + 26, columns[1].width, "right");
    drawCellText(ctx, formatWholeMoney(row.financeAmount), columns[2].x, y + 26, columns[2].width, "right");

    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillStyle = "#22c55e";
    drawCellText(ctx, formatPayment(row.payments.months48), columns[3].x, y + 26, columns[3].width, "right");
    drawCellText(ctx, formatPayment(row.payments.months60), columns[4].x, y + 26, columns[4].width, "right");
    drawCellText(ctx, formatPayment(row.payments.months72), columns[5].x, y + 26, columns[5].width, "right");
    drawCellText(ctx, formatPayment(row.payments.months84), columns[6].x, y + 26, columns[6].width, "right");
  });

  ctx.fillStyle = "#6f7785";
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText("คำนวณด้วยสูตร Flat Rate รวม VAT 7%", 56, height - 56);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("ไม่สามารถสร้างไฟล์รูปได้");

  const fileName = `bigcar-installment-${Date.now()}.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  const shareData = {
    title: "ตารางค่างวดรถมือสอง",
    text: "ตารางค่างวดจาก Big Car CRM",
    files: [file]
  };

  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function drawCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right"
) {
  ctx.textAlign = align;
  ctx.fillText(text, align === "right" ? x + width : x, y);
  ctx.textAlign = "left";
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

function formatPercent(value: number | null) {
  if (!value) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

function formatPayment(value: number) {
  return value ? formatWholeMoney(value) : "-";
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("โหลดรูปโปรไฟล์ไม่สำเร็จ"));
    image.src = src;
  });
}
