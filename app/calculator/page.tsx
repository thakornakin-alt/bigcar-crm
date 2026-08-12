"use client";

import { Calculator, Car, ImageDown, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NativeAppHeader, NativeAppShell, NativeButton, NativeCard } from "@/app/components/ui";
import { CalculatorQuotePreview, type CalculatorQuotePreviewHandle } from "@/app/calculator/CalculatorQuotePreview";
import { useSalesProfile } from "@/lib/use-sales-profile";
import type { InstallmentRow, InterestRate } from "@/lib/types";
import { calculatorProfileContract } from "@/lib/user-profile";

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
  const quotePreviewRef = useRef<CalculatorQuotePreviewHandle>(null);
  const { user: salesProfile } = useSalesProfile();
  const [rates, setRates] = useState<InterestRate[]>(defaultInterestRates);
  const [rateSource, setRateSource] = useState<"default" | "sheet">("default");
  const [vehicleType, setVehicleType] = useState(vehicleTypes[0]);
  const [yearRange, setYearRange] = useState("2022-2026");
  const [carModel, setCarModel] = useState("");
  const [actualYear, setActualYear] = useState("");
  const [carColor, setCarColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [selectedDownLabel, setSelectedDownLabel] = useState("20%");
  const [selectedTermKey, setSelectedTermKey] = useState<(typeof terms)[number]["key"]>("months72");
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

  const selectedQuoteRow = useMemo(() => {
    return rows.find((row) => row.label === selectedDownLabel) || rows[0] || null;
  }, [rows, selectedDownLabel]);

  const quoteModel = useMemo(() => ({
    carModel,
    actualYear,
    carColor,
    mileage,
    carPrice: price,
    rate: selectedRate || defaultInterestRates[0],
    rows,
    selectedDownLabel,
    selectedTermKey,
    profile: calculatorProfileContract(salesProfile)
  }), [actualYear, carColor, carModel, mileage, price, rows, salesProfile, selectedDownLabel, selectedRate, selectedTermKey]);

  useEffect(() => {
    if (!rows.length) return;
    if (!rows.some((row) => row.label === selectedDownLabel)) {
      setSelectedDownLabel(rows[0].label);
    }
  }, [rows, selectedDownLabel]);

  async function handleSaveImage() {
    if (!rows.length || !selectedRate) return;

    setExporting(true);
    setError("");

    try {
      await quotePreviewRef.current?.exportPng();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกรูปไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <NativeAppShell className="max-w-5xl">
      <NativeAppHeader
        title="คำนวณค่างวด"
        subtitle={salesProfile ? `ใช้โปรไฟล์เซลล์: ${salesProfile.nickname}` : "ยังไม่ได้ Login จะใช้ข้อมูลบิ๊กเป็นค่าเริ่มต้น"}
      />

      <NativeCard className="mb-4">
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
      </NativeCard>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <NativeCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-white">ตารางผ่อน</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
              <span>รุ่นรถ: {carModel.trim()}</span>
              <span>ปีรถ: {actualYear.trim()}</span>
            </div>
          </div>
          {rows.length ? (
            <NativeButton
              disabled={exporting}
              onClick={handleSaveImage}
              className="shrink-0 px-3"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <ImageDown size={18} />}
              บันทึกรูป
            </NativeButton>
          ) : (
            <Calculator size={24} className="shrink-0 text-brand" aria-hidden="true" />
          )}
        </div>

        {rows.length ? (
          <div className="overflow-x-auto" data-testid="calculator-values-table">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-soft">
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
                  <tr
                    key={`${row.label}-${row.downPayment}`}
                    className={`cursor-pointer border-b border-white/10 last:border-0 ${row.label === selectedDownLabel ? "bg-brand/15" : ""}`}
                    onClick={() => setSelectedDownLabel(row.label)}
                  >
                    <td className="px-4 py-3 font-bold text-white">
                      <button type="button" className="rounded-full border border-white/10 px-2 py-1" aria-pressed={row.label === selectedDownLabel}>
                        {row.label}
                      </button>
                    </td>
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
            กำลังโหลด
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-soft">กรอกราคารถและเลือกตารางดอกเบี้ย</div>
        )}
      </NativeCard>

      {rows.length > 0 && (
        <NativeCard className="calculator-preview-card p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Preview ก่อนส่งลูกค้า</p>
              <h2 className="mt-1 text-xl font-black text-white">ภาพค่างวด BIG CAR</h2>
              <p className="mt-1 text-sm text-soft">เลือกแถวดาวน์และจำนวนงวดจากตาราง ภาพที่เห็นคือภาพเดียวกับ PNG</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="เลือกจำนวนงวด">
              {terms.map((term) => (
                <button
                  key={term.key}
                  type="button"
                  onClick={() => setSelectedTermKey(term.key)}
                  aria-pressed={selectedTermKey === term.key}
                  className={`min-h-10 rounded-full border px-3 text-sm font-bold ${selectedTermKey === term.key ? "border-brand bg-brand text-white" : "border-white/10 text-white"}`}
                >
                  {term.label} งวด
                </button>
              ))}
            </div>
          </div>
          <CalculatorQuotePreview ref={quotePreviewRef} model={quoteModel} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:flex sm:items-center sm:justify-between">
            <span className="rounded-xl bg-white/5 px-3 py-2 text-soft">ดาวน์ {selectedQuoteRow?.label || "-"}</span>
            <span className="rounded-xl bg-white/5 px-3 py-2 text-right font-black text-brand">
              {formatWholeMoney(selectedQuoteRow?.payments[selectedTermKey] || 0)} บาท/เดือน
            </span>
          </div>
        </NativeCard>
      )}

      <NativeCard className="mb-4">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="สีรถ" value={carColor} onChange={setCarColor} placeholder="ขาว / เทา / ดำ" />
          <TextField label="เลขไมล์" value={mileage} onChange={setMileage} placeholder="เช่น 68,000 กม." />
        </div>
        <div className="mt-3 rounded-2xl border border-brand/30 bg-brand/10 px-3 py-3 text-sm font-semibold text-brand">
          Quote mode locked: Installment Mode
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
            className="flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 px-3 font-semibold text-white"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </NativeCard>
    </NativeAppShell>
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
  options,
  optionLabels
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none focus:border-brand"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] || option}
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
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
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
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
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

function formatPercent(value: number | null) {
  if (!value) return "-";
  return `${(value * 100).toFixed(2)}%`;
}
