"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Loader2,
  Search,
  Users,
  XCircle
} from "lucide-react";
import { PageContainer, PageTitle, SectionCard } from "@/app/components/ui";
import {
  calculateMonthlyCommission,
  calculateQuarterlyBonus,
  getCommissionMonthKey,
  isCommissionEligible,
  resolveBaseCommission
} from "@/lib/commission-calculator";
import type { BookingDeliveryRecord } from "@/lib/types";

type FetchState = "idle" | "loading" | "ready" | "error";

type MonthlyOwnerSummary = ReturnType<typeof calculateMonthlyCommission>[number];

type DetailRow = {
  record: BookingDeliveryRecord;
  monthKey: string;
  isEligible: boolean;
  isDelivered: boolean;
  hasOwner: boolean;
  hasGrade: boolean;
  ownerKey: string;
  commissionAmount: number;
  statusLabel: string;
};

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.warning || "Request failed");
  return data;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string) {
  const raw = text(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function monthLabel(month: string) {
  const lookup: Record<string, string> = {
    "01": "ม.ค.",
    "02": "ก.พ.",
    "03": "มี.ค.",
    "04": "เม.ย.",
    "05": "พ.ค.",
    "06": "มิ.ย.",
    "07": "ก.ค.",
    "08": "ส.ค.",
    "09": "ก.ย.",
    "10": "ต.ค.",
    "11": "พ.ย.",
    "12": "ธ.ค."
  };
  return lookup[month] || month;
}

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}

function currentYear() {
  return String(new Date().getFullYear());
}

function normalizeOwner(record: BookingDeliveryRecord) {
  return text(record.ownerForCommission || record.saleName || record.teamName || "-");
}

function normalizeGrade(record: BookingDeliveryRecord) {
  return text(record.commissionGrade || "");
}

function getEligibleMonthlyRows(records: BookingDeliveryRecord[], selectedMonth: string, selectedYear: string) {
  const month = selectedMonth.slice(5, 7);
  const year = selectedYear;
  return records.filter((record) => {
    const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
    if (!key) return false;
    if (key.month !== month || key.year !== year) return false;
    return isCommissionEligible(record);
  });
}

export default function CommissionPage() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(todayMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear());
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setState("loading");
      setError("");
      try {
        const data = await api<{ records: BookingDeliveryRecord[] }>("/api/booking-delivery");
        if (!alive) return;
        setRecords(Array.isArray(data.records) ? data.records : []);
        setState("ready");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "โหลดข้อมูล Commission ไม่สำเร็จ");
        setRecords([]);
        setState("error");
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const selectedMonthYear = `${selectedYear}-${selectedMonth.slice(5, 7)}`;
  const monthlyRecords = useMemo(() => getEligibleMonthlyRows(records, selectedMonth, selectedYear), [records, selectedMonth, selectedYear]);
  const monthlyResults = useMemo(
    () => calculateMonthlyCommission(records, selectedMonth.slice(5, 7), selectedYear),
    [records, selectedMonth, selectedYear]
  );

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>();
    for (const record of records) {
      const owner = normalizeOwner(record);
      if (owner && owner !== "-") owners.add(owner);
    }
    return Array.from(owners).sort((a, b) => a.localeCompare(b, "th"));
  }, [records]);

  const filteredMonthlyResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return monthlyResults
      .filter((row) => selectedOwner === "all" || row.ownerForCommission === selectedOwner)
      .filter((row) => {
        if (!normalizedQuery) return true;
        return row.ownerForCommission.toLowerCase().includes(normalizedQuery);
      });
  }, [monthlyResults, selectedOwner, query]);

  const overallSummary = useMemo(() => {
    const ownerCount = monthlyResults.length;
    const totalCars = monthlyResults.reduce((sum, row) => sum + row.totalCars, 0);
    const totalNet = monthlyResults.reduce((sum, row) => sum + row.totalCommission, 0);
    const missingGrade = records.filter((record) => {
      const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
      return Boolean(key && key.monthKey === selectedMonthYear) && isDeliveredRecord(record) && !normalizeGrade(record);
    }).length;
    const missingOwner = records.filter((record) => {
      const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
      return Boolean(key && key.monthKey === selectedMonthYear) && isDeliveredRecord(record) && !normalizeOwner(record);
    }).length;

    return { ownerCount, totalCars, totalNet, missingGrade, missingOwner };
  }, [monthlyResults, records, selectedMonthYear]);

  const detailRows = useMemo<DetailRow[]>(() => {
    return records
      .filter((record) => {
        const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
        return Boolean(key && key.monthKey === selectedMonthYear);
      })
      .map((record) => {
        const ownerKey = normalizeOwner(record);
        const grade = normalizeGrade(record);
        const isEligible = isCommissionEligible(record);
        const isDelivered = isDeliveredRecord(record);
        const monthKey = getCommissionMonthKey(record.deliveryCompletedDate || "")?.monthKey || "-";
        const total = resolveBaseCommission(grade as "G1" | "G2" | "G3" | "");
        return {
          record,
          monthKey,
          isEligible,
          isDelivered,
          hasOwner: Boolean(ownerKey && ownerKey !== "-"),
          hasGrade: Boolean(grade),
          ownerKey,
          commissionAmount: total,
          statusLabel: isEligible ? "นับคอม" : "ไม่นับ"
        };
      })
      .filter((row) => {
        if (selectedOwner === "all") return true;
        return row.ownerKey === selectedOwner;
      })
      .filter((row) => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return true;
        const haystack = [
          row.record.bookingId,
          row.record.plate,
          row.ownerKey,
          row.record.saleName,
          row.record.teamName,
          row.record.commissionGrade,
          row.record.status
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
  }, [records, query, selectedMonthYear, selectedOwner]);

  const excludedRows = useMemo(() => {
    return records.filter((record) => {
      const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
      if (!key || key.monthKey !== selectedMonthYear) return false;
      return !isCommissionEligible(record);
    });
  }, [records, selectedMonthYear]);

  const quarterlyResult = useMemo(() => {
    const month = Number(selectedMonth.slice(5, 7));
    const quarter: 1 | 2 | 3 | 4 =
      month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
    return calculateQuarterlyBonus(records, quarter, selectedYear);
  }, [records, selectedMonth, selectedYear]);

  function isCurrentMonth(monthValue: string) {
    return selectedMonth === `${selectedYear}-${monthValue}`;
  }

  return (
    <PageContainer wide>
      <PageTitle
        title="Commission"
        subtitle="Read-only summary from Booking Delivery records"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-soft">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Source of truth: Booking Delivery</span>
            <span className="rounded-full border border-brand/25 bg-brand/10 px-3 py-2 text-brand">Calculator: lib/commission-calculator.ts</span>
          </div>
        }
      />

      <SectionCard className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <label className="grid gap-2 text-sm font-bold text-white">
            เดือน
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-h-12 rounded-2xl border border-white/10 bg-[#0b0f15] px-4 text-white outline-none"
            >
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, "0");
                const value = `${selectedYear}-${month}`;
                return (
                  <option key={value} value={value}>
                    {monthLabel(month)}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-white">
            ปี
            <input
              type="number"
              min="2020"
              max="2100"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="min-h-12 rounded-2xl border border-white/10 bg-[#0b0f15] px-4 text-white outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-white">
            เซลส์
            <select
              value={selectedOwner}
              onChange={(event) => setSelectedOwner(event.target.value)}
              className="min-h-12 rounded-2xl border border-white/10 bg-[#0b0f15] px-4 text-white outline-none"
            >
              <option value="all">ทั้งหมด</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-white">
            ค้นหา
            <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0f15] px-4">
              <Search size={16} className="text-brand" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Booking ID / ทะเบียน / เซลส์"
                className="w-full border-none bg-transparent text-white outline-none placeholder:text-soft"
              />
            </div>
          </label>
        </div>
      </SectionCard>

      {state === "loading" ? (
        <SectionCard className="mb-5">
          <div className="flex items-center gap-3 text-soft">
            <Loader2 size={18} className="animate-spin text-brand" />
            กำลังโหลดข้อมูล Commission...
          </div>
        </SectionCard>
      ) : null}

      {state === "error" ? (
        <SectionCard className="mb-5">
          <div className="flex items-start gap-3 text-red-100">
            <AlertTriangle size={18} className="mt-0.5 text-red-300" />
            <div>
              <p className="font-bold">โหลดข้อมูลไม่สำเร็จ</p>
              <p className="mt-1 text-sm text-soft">{error}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="จำนวนเซลส์" value={overallSummary.ownerCount.toLocaleString("th-TH")} icon={<Users size={18} />} hint="เซลส์ที่มีคอมในเดือนนี้" />
        <SummaryCard label="จำนวนคันที่นับคอม" value={overallSummary.totalCars.toLocaleString("th-TH")} icon={<CircleDollarSign size={18} />} hint={`เดือน ${monthLabel(selectedMonth.slice(5, 7))} ${selectedYear}`} />
        <SummaryCard label="ค่าคอมรวมสุทธิ" value={formatMoney(overallSummary.totalNet)} icon={<CircleDollarSign size={18} />} hint="หลังหัก 3% และรวม fixed bonus" />
        <SummaryCard
          label="รายการ missing"
          value={`${overallSummary.missingGrade.toLocaleString("th-TH")} / ${overallSummary.missingOwner.toLocaleString("th-TH")}`}
          icon={<AlertTriangle size={18} />}
          tone="warning"
          hint="Grade / Owner"
        />
      </div>

      <SectionCard title="Owner Summary" className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredMonthlyResults.map((row) => (
            <div key={row.ownerForCommission} className="rounded-[22px] border border-white/10 bg-[#0b0f15] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-white">{row.ownerForCommission}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">{selectedMonthYear}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-soft">Net commission</p>
                  <p className="text-2xl font-black text-brand">{formatMoney(row.totalCommission)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <PillStat label="Cars" value={row.totalCars} />
                <PillStat label="G1" value={row.g1Count} />
                <PillStat label="G2" value={row.g2Count} />
                <PillStat label="G3" value={row.g3Count} />
                <PillStat label="Step" value={row.stepBonus} money />
                <PillStat label="Fixed" value={row.fixedBonus} money />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <InfoBox label="Base commission" value={row.baseCommissionTotal} />
                <InfoBox label="หัก 3%" value={Math.round(row.deductionAmount)} />
                <InfoBox label="Net monthly" value={Math.round(row.netMonthlyCommission)} />
                <InfoBox label="Total" value={Math.round(row.totalCommission)} />
              </div>
            </div>
          ))}

          {!filteredMonthlyResults.length && state === "ready" ? (
            <div className="rounded-[22px] border border-white/10 bg-[#0b0f15] p-4 text-sm text-soft">ไม่พบข้อมูลที่ตรงกับตัวกรอง</div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Detail Table" className="mb-5">
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-brand">
                <Th>Booking ID</Th>
                <Th>ทะเบียน</Th>
                <Th>เซลส์</Th>
                <Th>Grade</Th>
                <Th>วันส่งมอบ</Th>
                <Th>คอมรายคัน</Th>
                <Th>สถานะนับคอม</Th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr key={row.record.id} className="align-top odd:bg-white/[0.02]">
                  <Td>{row.record.bookingId || "-"}</Td>
                  <Td>{row.record.plate || "-"}</Td>
                  <Td>{row.ownerKey || "-"}</Td>
                  <Td>{row.record.commissionGrade || "-"}</Td>
                  <Td>{formatDate(row.record.deliveryCompletedDate || "")}</Td>
                  <Td>{formatMoney(resolveBaseCommission(row.record.commissionGrade || ""))}</Td>
                  <Td>
                    <span
                      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-black ${
                        row.isEligible ? "bg-brand/10 text-brand" : "bg-white/5 text-soft"
                      }`}
                    >
                      {row.statusLabel}
                    </span>
                  </Td>
                </tr>
              ))}
              {!detailRows.length ? (
                <tr>
                  <td className="px-0 py-4 text-sm text-soft" colSpan={7}>
                    ไม่พบข้อมูลในช่วงเดือนนี้
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Excluded Records">
          <div className="grid gap-4">
            <ExcludedBlock
              title="Missing grade"
              items={records.filter((record) => {
                const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
                return Boolean(key && key.monthKey === selectedMonthYear) && isDeliveredRecord(record) && !normalizeGrade(record);
              })}
            />
            <ExcludedBlock
              title="Missing owner"
              items={records.filter((record) => {
                const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
                return Boolean(key && key.monthKey === selectedMonthYear) && isDeliveredRecord(record) && !normalizeOwner(record);
              })}
            />
            <ExcludedBlock
              title="Not delivered / cancelled"
              items={excludedRows.filter((record) => {
                const status = text(record.status);
                return status === "ยกเลิก" || !isDeliveredRecord(record);
              })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Quarterly Bonus">
          <div className="grid gap-4">
            <div className="rounded-[22px] border border-white/10 bg-[#0b0f15] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-soft">Quarter {quarterlyResult.quarter}</p>
                  <p className="mt-1 text-2xl font-black text-white">{formatMoney(quarterlyResult.bonus)}</p>
                </div>
                <span className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                  {quarterlyResult.quarterCount.toLocaleString("th-TH")} คัน
                </span>
              </div>
              <p className="mt-2 text-sm text-soft">Quarterly bonus is read-only and separate from monthly commission.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-brand">
                    <Th>Booking ID</Th>
                    <Th>ทะเบียน</Th>
                    <Th>เซลส์</Th>
                    <Th>วันส่งมอบ</Th>
                  </tr>
                </thead>
                <tbody>
                  {quarterlyResult.eligibleRecords.map((record) => (
                    <tr key={record.id}>
                      <Td>{record.bookingId || "-"}</Td>
                      <Td>{record.plate || "-"}</Td>
                      <Td>{normalizeOwner(record)}</Td>
                      <Td>{formatDate(record.deliveryCompletedDate || "")}</Td>
                    </tr>
                  ))}
                  {!quarterlyResult.eligibleRecords.length ? (
                    <tr>
                      <td className="px-0 py-4 text-sm text-soft" colSpan={4}>
                        ไม่มีรายการที่เข้าเงื่อนไข quarterly
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  hint,
  tone = "brand"
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: "brand" | "warning";
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,32,0.92),rgba(7,10,15,0.94))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-soft">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${
            tone === "warning" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-brand/25 bg-brand/10 text-brand"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-soft">{hint}</p> : null}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#11151d] px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-brand">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

function PillStat({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-soft">{label}</p>
      <p className="mt-0.5 font-black text-white">{money ? formatMoney(value) : value.toLocaleString("th-TH")}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-white/10 px-4 py-3">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-white/5 px-4 py-3 text-white">{children}</td>;
}

function ExcludedBlock({ title, items }: { title: string; items: BookingDeliveryRecord[] }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0b0f15] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">{title}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-soft">
          {items.length.toLocaleString("th-TH")}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {items.slice(0, 5).map((record) => (
          <div key={record.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-soft">
            <p className="font-bold text-white">{record.bookingId || "-"}</p>
            <p className="mt-1">
              {record.plate || "-"} · {record.saleName || record.teamName || "-"} · {record.commissionGrade || "-"}
            </p>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-soft">ไม่มีรายการ</p> : null}
      </div>
    </div>
  );
}

function isDeliveredRecord(record: BookingDeliveryRecord) {
  const status = text(record.status);
  return status === "ยอดส่งมอบ" || status === "ส่งมอบแล้ว";
}
