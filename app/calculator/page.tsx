"use client";

import Link from "next/link";
import { ArrowLeft, Calculator, Car, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { InstallmentRow, InterestRate } from "@/lib/types";

const vehicleTypes = ["รถเก๋ง/กระบะ 4 ประตู", "รถกระบะ/รถตู้"];
const downRates = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
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

function calculatePayment(financeAmount: number, rate: number | null, months: number, years: number) {
  if (!rate || financeAmount <= 0) return null;
  return roundCurrency(((financeAmount * rate * years + financeAmount) / months) * 1.07);
}

export default function CalculatorPage() {
  const [rates, setRates] = useState<InterestRate[]>([]);
  const [vehicleType, setVehicleType] = useState(vehicleTypes[0]);
  const [yearRange, setYearRange] = useState("2022-2026");
  const [carPrice, setCarPrice] = useState("684000");
  const [specialDownPayment, setSpecialDownPayment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRates() {
    setError("");
    const data = await api<{ rates: InterestRate[] }>("/api/finance/rates");
    setRates(data.rates);
  }

  useEffect(() => {
    loadRates()
      .catch((err) => setError(err.message))
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">คำนวณค่างวด</h1>
        </div>
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
        >
          <ArrowLeft size={18} className="text-brand" aria-hidden="true" />
          ลูกค้า
        </Link>
      </header>

      <section className="mb-4 rounded-lg border border-line bg-panel p-4 shadow-glow">
        <div className="grid gap-3 md:grid-cols-2">
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
            {selectedRate ? "ใช้ดอกเบี้ยจาก Google Sheet" : "ไม่พบตารางดอกเบี้ยสำหรับตัวเลือกนี้"}
          </span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadRates()
                .catch((err) => setError(err.message))
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
            <p className="mt-1 text-sm text-soft">รวม VAT 7% ตามสูตรใน Excel</p>
          </div>
          <Calculator size={24} className="shrink-0 text-brand" aria-hidden="true" />
        </div>

        {loading ? (
          <div className="flex min-h-36 items-center justify-center text-soft">
            <Loader2 size={22} className="mr-2 animate-spin" />
            Loading
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-soft">
                  <th className="px-4 py-3 font-semibold">เรทดาวน์</th>
                  <th className="px-4 py-3 text-right font-semibold">เงินดาวน์</th>
                  <th className="px-4 py-3 text-right font-semibold">ยอดจัด</th>
                  <th className="px-4 py-3 text-right font-semibold">48 งวด</th>
                  <th className="px-4 py-3 text-right font-semibold">60 งวด</th>
                  <th className="px-4 py-3 text-right font-semibold">72 งวด</th>
                  <th className="px-4 py-3 text-right font-semibold">84 งวด</th>
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

function PaymentCell({ value }: { value: number }) {
  return (
    <td className="px-4 py-3 text-right font-bold text-brand">
      {value ? formatMoney(value) : "-"}
    </td>
  );
}
