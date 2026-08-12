"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, Calculator, CarFront, ChevronDown, Fuel, RefreshCw, WalletCards } from "lucide-react";
import { calculateMonthlyStatement } from "@/lib/commission";
import { COMMISSION_CLOSING_FIXTURES, COMMISSION_PREVIEW_RULES, COMMISSION_PREVIEW_SNAPSHOTS } from "@/lib/commission-fixtures";
import { COMMISSION_ISSUE_LABELS, type CanonicalCommissionCandidate, type CommissionCandidateIssue, type CommissionCandidateQuality } from "@/lib/commission-candidate";
import { useSalesProfile } from "@/lib/use-sales-profile";
import { commissionStateLabel } from "@/lib/commission-ui";

type IsolatedView = {
  mode: "isolated_fixture";
  realWritesEnabled: false;
  pendingClosingCount: number;
  cases: Array<{ bookingCaseId: string; sourceMonth: string; vehiclePlate: string; vehicleModel?: string; caseStatus: string; discountAmount: number; commissionGroup?: string; assessment: { state: string; reasons: string[] }; disposition?: { action: string } }>;
  snapshots: Array<{ id: string; bookingCaseId: string }>;
  activity: Array<{ id: string; action: string }>;
  canonicalDataVerified?: boolean;
  candidateReadiness?: { candidates: CanonicalCommissionCandidate[]; counts: { ready: number; needsReview: number; excluded: number; blocked: number } };
};

function baht(value: number) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value); }
function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

const statement = calculateMonthlyStatement(COMMISSION_PREVIEW_SNAPSHOTS, COMMISSION_PREVIEW_RULES, "USER-PREVIEW-BIG");

export function CommissionPreviewClient() {
  const { user } = useSalesProfile();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [view, setView] = useState<IsolatedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closingChoices, setClosingChoices] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, "cancelled" | "customer_paused" | "other">>({});
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all" | CommissionCandidateQuality>("all");
  const [issueFilter, setIssueFilter] = useState<"all" | "group" | "salesperson" | "price" | "recognition" | "cancelled">("all");

  async function loadReadiness() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/commission-preview", { method: "GET", cache: "no-store" });
      const data = await response.json() as IsolatedView & { error?: string };
      if (!response.ok) throw new Error(data.error || "อ่านข้อมูลไม่สำเร็จ");
      setView(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "อ่านข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadReadiness(); }, []);
  const readiness = useMemo(() => ({
    eligible: view?.cases.filter((item) => item.assessment.state === "eligible_for_recognition").length || 0,
    needsReview: view?.cases.filter((item) => item.assessment.state === "needs_review").length || 0,
    blocked: view?.cases.filter((item) => item.assessment.state === "recognition_blocked").length || 0,
    working: view?.cases.filter((item) => item.assessment.state === "working").length || 0
  }), [view]);
  const issueCounts = useMemo(() => {
    const counts = new Map<CommissionCandidateIssue, number>();
    for (const candidate of view?.candidateReadiness?.candidates || []) for (const issue of candidate.needsReviewReasons) counts.set(issue, (counts.get(issue) || 0) + 1);
    return [...counts.entries()];
  }, [view]);
  const readinessCandidates = useMemo(() => (view?.candidateReadiness?.candidates || []).filter((candidate) => {
    if (qualityFilter !== "all" && candidate.quality !== qualityFilter) return false;
    if (issueFilter === "group") return candidate.needsReviewReasons.some((item) => item === "missing_commission_group" || item === "invalid_commission_group");
    if (issueFilter === "salesperson") return candidate.needsReviewReasons.includes("missing_salesperson_identity");
    if (issueFilter === "price") return candidate.needsReviewReasons.some((item) => item === "missing_standard_price" || item === "missing_sale_price" || item === "invalid_discount");
    if (issueFilter === "recognition") return candidate.needsReviewReasons.includes("missing_recognition_date");
    if (issueFilter === "cancelled") return candidate.needsReviewReasons.includes("cancelled_but_counted");
    return true;
  }), [view, qualityFilter, issueFilter]);

  async function persistClosing(item: typeof COMMISSION_CLOSING_FIXTURES[number], action: "carry_forward" | "do_not_carry") {
    setError("");
    const response = await fetch("/api/commission-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, bookingCaseId: item.bookingCaseId === "pending-1" ? "ISO-WAITING-G2" : "ISO-PAUSED-G3", sourceMonth: "2026-07", reason: action === "do_not_carry" ? (reasons[item.bookingCaseId] || "other") : undefined }) });
    const data = await response.json() as { error?: string; view?: IsolatedView };
    if (!response.ok) { setError(data.error || "บันทึกข้อมูลทดสอบไม่สำเร็จ"); return; }
    if (data.view) setView(data.view);
    setClosingChoices((value) => ({ ...value, [item.bookingCaseId]: action }));
  }

  async function recognize(bookingCaseId: string, method: "delivered" | "manual_cutoff") {
    setError("");
    const response = await fetch("/api/commission-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recognize", bookingCaseId, method, recognizedMonth: "2026-08" }) });
    const data = await response.json() as { error?: string; view?: IsolatedView };
    if (!response.ok) { setError(data.error || "ทดสอบการรับรู้ไม่สำเร็จ"); return; }
    if (data.view) setView(data.view);
  }

  async function saveAdjustment() {
    const snapshotId = view?.snapshots[0]?.id;
    if (!snapshotId) return;
    setError("");
    const response = await fetch("/api/commission-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "adjust", snapshotId, amount: Number(adjustmentAmount), reason: adjustmentReason }) });
    const data = await response.json() as { error?: string; view?: IsolatedView };
    if (!response.ok) { setError(data.error || "ทดสอบการปรับค่าคอมไม่สำเร็จ"); return; }
    if (data.view) setView(data.view);
    setAdjustmentAmount(""); setAdjustmentReason("");
  }

  const attentionCount = (view?.candidateReadiness?.counts.needsReview || 0) + (view?.candidateReadiness?.counts.blocked || 0);

  return <main className="mx-auto min-h-screen w-full max-w-[1440px] overflow-x-hidden px-3 pb-16 sm:px-5 lg:px-8">
    <header className="mb-4 rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(214,182,108,0.16),transparent_42%),linear-gradient(145deg,#17191d,#08090b)] p-4 sm:p-6">
      <div className="flex items-start gap-3"><Link href="/rdd-home" aria-label="กลับ RDD Home" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white"><ArrowLeft size={18} /></Link><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#d6b66c]">ค่าคอมประจำ {monthLabel(COMMISSION_PREVIEW_RULES.month)}</p><h1 className="mt-2 text-2xl font-black text-white sm:text-4xl">สรุปค่าคอมเดือนนี้</h1><p className="mt-1 text-sm text-white/55">ติดตามยอดรถ ค่าคอม Step และค่าน้ำมันในหน้าเดียว</p></div></div>
    </header>

    <section aria-label="สรุปค่าคอม" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryMetric label="จำนวนรถที่นับ" value={`${statement.totalPhysicalCars} คัน`} icon={CarFront} />
      <SummaryMetric label="จำนวนคันถ่วงน้ำหนัก" value={statement.totalWeightedCars.toFixed(1)} icon={Calculator} />
      <SummaryMetric label="ค่าคอมรายคัน" value={`${baht(statement.netVehicleCommission)} ฿`} icon={WalletCards} />
      <SummaryMetric label="Step เดือนนี้" value={`${baht(statement.monthlyStep)} ฿`} icon={BadgeCheck} />
      <SummaryMetric label="ค่าน้ำมัน" value={`${baht(statement.fuelAllowance)} ฿`} icon={Fuel} />
      <SummaryMetric label="ยอดรวมประมาณการ" value={`${baht(statement.finalTotal)} ฿`} icon={WalletCards} prominent />
    </section>

    {(attentionCount > 0 || (view?.pendingClosingCount || 0) > 0 || readiness.working > 0) && <section aria-label="ต้องดำเนินการ" className="mt-4 rounded-[22px] border border-amber-300/20 bg-amber-300/[0.06] p-4">
      <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-200" /><h2 className="font-black text-white">ต้องดำเนินการ</h2></div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">{attentionCount > 0 && <p className="rounded-xl bg-black/20 px-3 py-2 text-amber-100">มี {attentionCount} รายการต้องตรวจสอบข้อมูล</p>}{Boolean(view?.pendingClosingCount) && <a href="#monthly-closing" className="rounded-xl bg-black/20 px-3 py-2 text-white">มี {view?.pendingClosingCount} รายการรอปิดยอด</a>}{readiness.working > 0 && <p className="rounded-xl bg-black/20 px-3 py-2 text-white">มี {readiness.working} รายการกำลังดำเนินการ</p>}</div>
    </section>}

    {attentionCount > 0 && <details data-testid="sales-readiness" className="mt-4 rounded-[22px] border border-white/10 bg-[#111317] p-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3"><div><h2 className="font-black text-white">ต้องตรวจสอบข้อมูล {attentionCount} รายการ</h2><p className="mt-1 text-xs text-white/45">ดูสาเหตุที่ต้องแก้ไขก่อนนับค่าคอม</p></div><ChevronDown size={18} className="text-[#d6b66c]" /></summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{issueCounts.map(([issue, count]) => <div key={issue} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm"><span className="text-white/70">{COMMISSION_ISSUE_LABELS[issue]}</span><strong className="text-amber-100">{count}</strong></div>)}</div>
    </details>}

    <section className="mt-4 rounded-[24px] border border-white/10 bg-[#111317] p-3 sm:p-5">
      <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d6b66c]">MY COMMISSION</p><h2 className="mt-1 text-xl font-black text-white">รายการรถของฉัน</h2></div><p className="text-xs text-white/45">หัก 3% เฉพาะค่าคอมรายคัน</p></div>
      <div className="mt-4 grid gap-2">{COMMISSION_PREVIEW_SNAPSHOTS.map((item) => <article key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 sm:grid-cols-[1.4fr_.6fr_.6fr_.8fr] sm:items-center">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-lg bg-[#d6b66c] px-2 py-1 text-xs font-black text-[#17120a]">{item.commissionGroup}</span><strong className="truncate text-white">{item.vehiclePlate}</strong></div><p className="mt-1 truncate text-xs text-white/50">{item.vehicleModel}</p><p className="mt-1 text-[10px] font-bold text-emerald-200 sm:hidden">รับรู้ค่าคอมแล้ว</p></div>
        <div className="hidden sm:block"><p className="text-[10px] text-white/40">ส่วนลด</p><p className="font-bold text-white">{baht(item.discountAmount)} ฿</p></div>
        <div className="hidden sm:block"><p className="text-[10px] text-white/40">สถานะ</p><p className="text-xs font-bold text-emerald-200">รับรู้ค่าคอมแล้ว</p></div>
        <div className="text-right"><p className="text-[10px] text-white/40">ค่าคอมสุทธิ</p><p className="text-lg font-black text-emerald-200">{baht(item.netVehicleCommission)} ฿</p><p className="mt-1 text-[10px] text-white/40 sm:hidden">ลด {baht(item.discountAmount)} ฿ · น้ำหนัก {item.countWeight}</p></div>
      </article>)}</div>
    </section>

    <section id="monthly-closing" className="mt-4 rounded-[24px] border border-white/10 bg-[#111317] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-black text-white">ปิดยอดเดือน กรกฎาคม 2569</h2><p className="mt-1 text-sm text-white/45">ตรวจรายการที่ยังไม่รับรู้ก่อนเริ่มเดือนใหม่</p></div><span className="rounded-full bg-rose-300/10 px-3 py-1 text-xs font-bold text-rose-100">รอดำเนินการ</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{COMMISSION_CLOSING_FIXTURES.map((item) => <article key={item.bookingCaseId} className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-white">{item.plate}</strong><p className="text-xs text-white/45">{item.model} · {item.status}</p></div><strong className="text-amber-100">~{baht(item.estimated)} ฿</strong></div><p className="mt-3 text-xs text-white/45">รอเลือกยกไปเดือนหน้าหรือไม่นับในรอบถัดไป</p></article>)}</div>
    </section>

    {error && <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100"><p>{error}</p><button type="button" onClick={() => void loadReadiness()} className="mt-2 min-h-10 font-black">ลองใหม่</button></div>}

    {isAdmin && <details data-testid="admin-diagnostics" className="mt-4 rounded-[24px] border border-white/10 bg-[#0c0e11] p-4 sm:p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between"><div><h2 className="font-black text-white">ข้อมูลตรวจสอบระบบ</h2><p className="mt-1 text-xs text-white/40">สำหรับ Admin และการทดสอบ Preview</p></div><ChevronDown size={18} className="text-[#d6b66c]" /></summary>
      <div className="mt-4 border-t border-white/8 pt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d6b66c]">Canonical adapter · fixture mapped</p><p className="mt-1 text-xs text-amber-100">CODE READY · REAL DATA PENDING</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="READY" value={view?.candidateReadiness?.counts.ready || 0} tone="green" /><Metric label="NEEDS_REVIEW" value={view?.candidateReadiness?.counts.needsReview || 0} tone="amber" /><Metric label="EXCLUDED" value={view?.candidateReadiness?.counts.excluded || 0} tone="muted" /><Metric label="BLOCKED" value={view?.candidateReadiness?.counts.blocked || 0} tone="muted" /></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{([["all", "ทั้งหมด"], ["READY", "READY"], ["NEEDS_REVIEW", "NEEDS_REVIEW"], ["EXCLUDED", "EXCLUDED"], ["BLOCKED", "BLOCKED"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setQualityFilter(value)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-black ${qualityFilter === value ? "border-[#d6b66c] bg-[#d6b66c] text-[#17120a]" : "border-white/10 text-white/65"}`}>{label}</button>)}</div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{([["all", "ทุกประเด็น"], ["group", "ไม่มี Group"], ["salesperson", "ไม่มี Salesperson ID"], ["price", "ราคาไม่ครบ"], ["recognition", "Recognition ไม่ชัด"], ["cancelled", "ยกเลิกแต่ยังนับ"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setIssueFilter(value)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-bold ${issueFilter === value ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 text-white/55"}`}>{label}</button>)}</div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">{readinessCandidates.map((candidate) => <DiagnosticCandidateCard key={candidate.bookingCaseId} candidate={candidate} />)}</div>
      </div>

      <div className="mt-5 border-t border-white/8 pt-4"><h3 className="font-black text-white">เครื่องมือทดสอบ Preview</h3><p className="mt-1 text-xs text-amber-100">สำหรับทดสอบ Preview เท่านั้น</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{view?.cases.map((item) => <article key={item.bookingCaseId} className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-white">{item.vehiclePlate}</strong><span className="block truncate text-xs text-white/45">{item.vehicleModel || "ยังไม่ระบุรุ่น"}</span></div><span className="text-[10px] font-black text-amber-100">{item.assessment.state}</span></div>{item.assessment.state === "eligible_for_recognition" && <button type="button" onClick={() => void recognize(item.bookingCaseId, "delivered")} className="mt-3 min-h-11 w-full rounded-xl bg-[#d6b66c] text-sm font-black text-[#17120a]">รับรู้จากการส่งมอบ</button>}{item.assessment.state === "working" && <button type="button" onClick={() => void recognize(item.bookingCaseId, "manual_cutoff")} className="mt-3 min-h-11 w-full rounded-xl border border-[#d6b66c]/40 text-sm font-black text-amber-100">ตัดยอดค่าคอม (fixture)</button>}</article>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{COMMISSION_CLOSING_FIXTURES.map((item) => <article key={item.bookingCaseId} className="rounded-2xl border border-white/8 bg-black/20 p-3"><strong className="text-white">{item.plate}</strong><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void persistClosing(item, "carry_forward")} className={`min-h-11 rounded-xl border px-2 text-sm font-black ${closingChoices[item.bookingCaseId] === "carry_forward" ? "border-[#d6b66c] bg-[#d6b66c] text-[#17120a]" : "border-white/12 text-white"}`}>ยกไปเดือนหน้า</button><button type="button" onClick={() => void persistClosing(item, "do_not_carry")} className="min-h-11 rounded-xl border border-white/12 px-2 text-sm font-black text-white">ไม่ยกไป</button></div><select aria-label={`เหตุผลไม่ยก ${item.plate}`} value={reasons[item.bookingCaseId] || "other"} onChange={(event) => setReasons((value) => ({ ...value, [item.bookingCaseId]: event.target.value as "cancelled" | "customer_paused" | "other" }))} className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#17191d] px-3 text-sm text-white"><option value="cancelled">ยกเลิก</option><option value="customer_paused">ลูกค้าชะลอ</option><option value="other">อื่น ๆ</option></select></article>)}</div>
        {Boolean(view?.snapshots.length) && <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-black text-white">ปรับค่าคอมเพิ่มเติม</p><p className="mt-1 text-xs text-white/45">ค่าเก็บงาน · ค่าซ่อม · ค่าใช้จ่ายเพิ่มเติม · ปรับแก้ตามอนุมัติ · อื่น ๆ</p><div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><input aria-label="จำนวนเงินปรับค่าคอม" inputMode="numeric" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="จำนวนเงิน +/-" className="min-h-11 rounded-xl border border-white/12 bg-[#17191d] px-3 text-white" /><input aria-label="เหตุผลปรับค่าคอม" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="เหตุผล (บังคับ)" className="min-h-11 rounded-xl border border-white/12 bg-[#17191d] px-3 text-white" /><button type="button" disabled={!adjustmentAmount || !adjustmentReason.trim()} onClick={() => void saveAdjustment()} className="min-h-11 rounded-xl bg-[#d6b66c] px-4 font-black text-[#17120a] disabled:opacity-40">บันทึก</button></div></div>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="eligible_for_recognition" value={readiness.eligible} tone="green" /><Metric label="working" value={readiness.working} tone="muted" /><Metric label="needs_review" value={readiness.needsReview} tone="amber" /><Metric label="recognition_blocked" value={readiness.blocked} tone="muted" /></div>
      <div className="mt-3 space-y-2 text-sm text-white/65"><Reason label="Closing ค้าง" value={view?.pendingClosingCount || 0} /><Reason label="Snapshots" value={view?.snapshots.length || 0} /><Reason label="Activity" value={view?.activity.length || 0} /></div>
      <div className="mt-4 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p>COMMISSION_REAL_WRITES_ENABLED=false · endpoint จริงปฏิเสธ write และ fixture store ไม่ใช่ canonical Booking Delivery</p></div>
      {loading && <RefreshCw size={18} className="mt-4 animate-spin text-[#d6b66c]" />}
    </details>}
  </main>;
}

function SummaryMetric({ label, value, icon: Icon, prominent = false }: { label: string; value: string; icon: typeof CarFront; prominent?: boolean }) {
  return <div className={`min-w-0 rounded-2xl border p-3 ${prominent ? "border-[#d6b66c]/35 bg-[#d6b66c]/10" : "border-white/10 bg-white/[0.045]"}`}><Icon size={16} className="text-[#d6b66c]" /><p className="mt-3 text-[11px] text-white/50">{label}</p><p className="mt-1 truncate text-lg font-black text-white">{value}</p></div>;
}
function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "muted" }) {
  const color = tone === "green" ? "text-emerald-200" : tone === "amber" ? "text-amber-100" : "text-white/60";
  return <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-center"><p className={`text-2xl font-black ${color}`}>{value}</p><p className="break-words text-[10px] text-white/40">{label}</p></div>;
}
function Reason({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between gap-3"><span>{label}</span><strong className="text-white">{value}</strong></div>; }

function DiagnosticCandidateCard({ candidate }: { candidate: CanonicalCommissionCandidate }) {
  const source = candidate.sourceTrace;
  return <article className="min-w-0 rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-white">{candidate.vehiclePlate || "ไม่ระบุทะเบียน"}</strong><span className="block truncate text-xs text-white/45">{candidate.salespersonDisplayName || "ไม่ระบุพนักงานขาย"} · {candidate.caseStatus || "ไม่ระบุสถานะ"}</span></div><span className="shrink-0 text-[10px] font-black text-amber-100">{candidate.quality}</span></div>{candidate.needsReviewReasons.length ? <div className="mt-2 flex flex-wrap gap-1">{candidate.needsReviewReasons.map((issue) => <span key={issue} className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-white/70">{COMMISSION_ISSUE_LABELS[issue]}</span>)}</div> : <p className="mt-2 text-xs text-emerald-200">{commissionStateLabel(candidate.recognitionState)}</p>}<details className="mt-2 text-xs text-white/45"><summary className="min-h-9 cursor-pointer py-2 font-bold text-white/55">Source trace</summary><div className="space-y-1 border-t border-white/8 pt-2"><p>Salesperson: {source.salespersonUserIdSource.kind} {source.salespersonUserIdSource.reference || "—"}</p><p>Group: {source.commissionGroupSource.kind} {source.commissionGroupSource.reference || "—"}</p><p>Standard: {source.standardPriceSource.kind} {source.standardPriceSource.reference || "—"}</p><p>Sale: {source.salePriceSource.kind} {source.salePriceSource.reference || "—"}</p><p>Discount: {source.discountSource.kind} {source.discountSource.reference || "—"}</p></div></details></article>;
}
