"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CarFront, RefreshCw, WalletCards } from "lucide-react";

type RealItem = {
  id: string; plate: string; model: string; deliveredAt?: string; group?: string; standardPrice?: number; salePrice?: number; discountAmount?: number;
  status: "ready" | "needs_review"; issues: string[]; countWeight?: number; netVehicleCommission?: number;
};
type RealView = {
  mode: "real_read_only"; month: string; salesperson: { id: string; name: string; nickname?: string }; source: string;
  summary: { physicalCars: number; weightedCars: number; netVehicleCommission: number; withholdingTax: number; monthlyStep: number; fuelAllowance: number; finalTotal: number; needsReview: number };
  items: RealItem[];
};

function baht(value: number) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value || 0); }
function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

export function CommissionRealClient() {
  const [view, setView] = useState<RealView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/commission-real", { cache: "no-store" });
      const data = await response.json() as RealView & { error?: string };
      if (!response.ok) throw new Error(data.error || "โหลดค่าคอมไม่สำเร็จ");
      setView(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดค่าคอมไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <main className="mx-auto min-h-screen w-full max-w-[1200px] px-3 pb-24"><div className="rounded-3xl border border-white/10 bg-[#111317] p-6 text-white/60">กำลังโหลดข้อมูลค่าคอมจริง…</div></main>;
  if (error || !view) return <main className="mx-auto min-h-screen w-full max-w-[1200px] px-3 pb-24"><div className="rounded-3xl border border-red-400/20 bg-red-950/20 p-6 text-red-100">{error || "ไม่พบข้อมูล"}</div></main>;

  return <main className="mx-auto min-h-screen w-full max-w-[1200px] px-3 pb-24 sm:px-5">
    <header className="mb-4 rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(214,182,108,0.16),transparent_42%),linear-gradient(145deg,#17191d,#08090b)] p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-[#d6b66c]">REAL DATA · READ ONLY</p><h1 className="mt-1 text-2xl font-black text-white">ค่าคอม {monthLabel(view.month)}</h1><p className="mt-1 text-sm text-white/55">{view.salesperson.nickname || view.salesperson.name} · ข้อมูลจาก Booking Delivery จริง</p></div><button onClick={() => void load()} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white" aria-label="รีเฟรช"><RefreshCw size={18}/></button></div>
    </header>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Metric label="รถที่นับได้" value={`${view.summary.physicalCars} คัน`} icon={CarFront}/><Metric label="คันถ่วงน้ำหนัก" value={view.summary.weightedCars.toFixed(1)} icon={CarFront}/><Metric label="ค่าคอมรายคัน" value={`${baht(view.summary.netVehicleCommission)} ฿`} icon={WalletCards}/><Metric label="Step" value={`${baht(view.summary.monthlyStep)} ฿`} icon={WalletCards}/><Metric label="ค่าน้ำมัน" value={`${baht(view.summary.fuelAllowance)} ฿`} icon={WalletCards}/><Metric label="รวมประมาณการ" value={`${baht(view.summary.finalTotal)} ฿`} icon={WalletCards} prominent/>
    </section>

    {view.summary.needsReview > 0 && <div className="mt-4 flex gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100"><AlertTriangle className="shrink-0" size={18}/>มี {view.summary.needsReview} คันที่ส่งมอบแล้วแต่ข้อมูลยังไม่ครบ จึงยังไม่รวมในยอดค่าคอม</div>}

    <section className="mt-4 rounded-[24px] border border-white/10 bg-[#111317] p-3 sm:p-5"><h2 className="text-xl font-black text-white">รถส่งมอบของฉันเดือนนี้</h2><p className="mt-1 text-xs text-white/45">นับจากวันส่งมอบจริง · ไม่รวม QA / ยกเลิก / รายการที่ตั้งว่าไม่นับ</p>
      <div className="mt-4 grid gap-2">{view.items.length === 0 ? <div className="rounded-2xl bg-black/20 p-5 text-center text-sm text-white/45">ยังไม่มีรถส่งมอบที่ตรงเงื่อนไขในเดือนนี้</div> : view.items.map((item) => <article key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2">{item.group && <span className="rounded-lg bg-[#d6b66c] px-2 py-1 text-xs font-black text-[#17120a]">{item.group}</span>}<strong className="text-white">{item.plate}</strong></div><p className="mt-1 truncate text-xs text-white/50">{item.model}</p><p className="mt-1 text-xs text-white/45">ส่วนลด {item.discountAmount === undefined ? "—" : `${baht(item.discountAmount)} ฿`} · น้ำหนัก {item.countWeight ?? "—"}</p></div><div className="text-right">{item.status === "ready" ? <><p className="text-[10px] text-white/40">ค่าคอมสุทธิ</p><p className="text-lg font-black text-emerald-200">{baht(item.netVehicleCommission || 0)} ฿</p></> : <><p className="text-xs font-black text-amber-200">รอตรวจข้อมูล</p><p className="mt-1 max-w-[180px] text-[10px] text-white/45">{item.issues.join(" · ")}</p></>}</div></div></article>)}</div>
    </section>
    <p className="mt-4 text-center text-[11px] text-white/35">V1 เป็น Read only — ยังไม่เขียน Snapshot/ปิดยอด/ปรับค่าคอมจริง</p>
  </main>;
}

function Metric({ label, value, icon: Icon, prominent = false }: { label: string; value: string; icon: typeof CarFront; prominent?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${prominent ? "border-[#d6b66c]/40 bg-[#d6b66c]/10" : "border-white/10 bg-[#111317]"}`}><Icon size={17} className="text-[#d6b66c]"/><p className="mt-2 text-[10px] font-bold text-white/45">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
}
