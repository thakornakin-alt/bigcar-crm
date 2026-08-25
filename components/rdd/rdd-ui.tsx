import type { ReactNode } from "react";
import { legacyStatusForRecord, type RddDisplayStatus } from "@/lib/rdd-phase2";
import type { BookingDeliveryRecord } from "@/lib/types";

export function RddStatusChip({ record, status }: { record?: BookingDeliveryRecord; status?: RddDisplayStatus }) {
  const value = status || (record ? legacyStatusForRecord(record) : "ไม่ระบุ");
  const tone = value === "ส่งมอบแล้ว"
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    : value === "ยกเลิก"
      ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
      : value === "รอผลไฟแนนซ์"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : value === "รอส่งมอบ"
          ? "border-sky-300/30 bg-sky-300/10 text-sky-100"
          : "border-[#d6b66c]/35 bg-[#d6b66c]/10 text-[#f6df9d]";
  return <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-black ${tone}`}>{value}</span>;
}

export function RddSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-label="กำลังโหลด">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-white/[0.045]" />
      ))}
    </div>
  );
}

export function RddEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-10 text-center">
      <p className="font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/55">{detail}</p>
    </div>
  );
}

export function RddError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4 text-rose-100">
      <p className="font-black">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="mt-1 text-sm">{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl border border-rose-200/30 px-4 text-sm font-black">ลองใหม่</button>
    </div>
  );
}

export function RddSection({ eyebrow, title, action, children }: { eyebrow?: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[16px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">{eyebrow}</p>}
          <h2 className="mt-1 text-lg font-black text-white sm:text-xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
