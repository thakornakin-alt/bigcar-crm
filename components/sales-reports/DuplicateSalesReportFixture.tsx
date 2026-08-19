"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CopyPlus, Eye, ShieldCheck, X } from "lucide-react";
import {
  DUPLICATE_UX_FIXTURE_REPORTS,
  createFixtureDraftFromExisting,
  findDuplicateTransactions,
  fixtureDraftId,
  type SalesReportFixture
} from "@/lib/sales-report-duplicate-fixture";
import type { SalesReportInput } from "@/lib/types";

type DialogState = { plate: string; matches: SalesReportFixture[] } | null;

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

export function DuplicateSalesReportFixture() {
  const [enabled, setEnabled] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [viewing, setViewing] = useState<SalesReportFixture | null>(DUPLICATE_UX_FIXTURE_REPORTS[0]);
  const [draft, setDraft] = useState<SalesReportInput | null>(null);
  const [draftSourceId, setDraftSourceId] = useState("");
  const [fixtureMessage, setFixtureMessage] = useState("");

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("duplicateFixture") === "1");
  }, []);

  if (!enabled) return null;

  function startFrom(source: SalesReportFixture) {
    setDraft(createFixtureDraftFromExisting(source));
    setDraftSourceId(source.id);
    setDialog(null);
    setViewing(null);
    setFixtureMessage("");
  }

  function checkFixture(input: Pick<SalesReportInput, "plate" | "customerName">) {
    const matches = findDuplicateTransactions(input, DUPLICATE_UX_FIXTURE_REPORTS);
    if (!matches.length) {
      setDialog(null);
      setFixtureMessage("ไม่พบธุรกรรมเดิมที่มีทั้งลูกค้าและทะเบียนตรงกัน — สามารถเริ่มรายการใหม่ได้");
      return;
    }
    setFixtureMessage("");
    setDialog({ plate: input.plate, matches });
  }

  return (
    <section data-testid="duplicate-fixture-panel" className="mb-4 rounded-xl border border-sky-400/40 bg-sky-950/20 p-4 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-sky-100"><ShieldCheck size={18} /> Preview Fixture</div>
          <h2 className="mt-1 text-lg font-black text-white">ทดสอบธุรกรรมทะเบียนซ้ำ</h2>
          <p className="mt-1 text-sm text-muted">Same plate ≠ same transaction · Same customer ≠ same transaction</p>
        </div>
        <span className="rounded-full border border-sky-400/30 px-3 py-1 text-xs text-sky-100">ไม่เขียนข้อมูลจริง</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" data-testid="fixture-check-duplicate" onClick={() => checkFixture({ plate: "1กก1234", customerName: "ลูกค้าตัวอย่าง" })} className="min-h-11 rounded-lg bg-brand px-4 font-bold text-ink">ทดลองทะเบียนและลูกค้าเดิม</button>
        <button type="button" data-testid="fixture-check-unique" onClick={() => checkFixture({ plate: "2ขข 5678", customerName: "ลูกค้าใหม่" })} className="min-h-11 rounded-lg border border-line bg-panel px-4 font-bold text-white">ทดลองรายการใหม่</button>
      </div>

      {fixtureMessage ? <p role="status" className="mt-3 rounded-lg bg-green-950/40 px-3 py-2 text-sm text-green-100">{fixtureMessage}</p> : null}

      {viewing && !draft ? (
        <div data-testid="fixture-existing-report" className="mt-4 rounded-xl border border-line bg-panel/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">รายงานขายเดิม · {viewing.id}</p>
              <p className="mt-1 text-lg font-black text-white">{viewing.plate} · {viewing.customerName}</p>
              <p className="mt-1 text-sm text-muted">{displayDate(viewing.createdAt)} · {viewing.saleName} · {viewing.status}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-sm font-bold text-white">แก้ไขรายงานเดิม</button>
              <button type="button" data-testid="fixture-create-from-existing" onClick={() => startFrom(viewing)} className="flex min-h-10 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-bold text-ink"><CopyPlus size={17} />สร้างรายงานใหม่จากข้อมูลนี้</button>
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div data-testid="fixture-new-draft" className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-400/40 bg-amber-950/30 p-3">
            <p className="font-black text-amber-100">รายงานใหม่ — คัดลอกจากรายงานเดิม</p>
            <p className="mt-1 text-sm text-amber-50">กรุณาตรวจสอบราคา วันที่ ลูกค้า รายละเอียดการชำระเงิน การส่งมอบ และพนักงานขายก่อนบันทึก</p>
            <p className="mt-1 text-xs text-amber-200">อ้างอิง {draftSourceId} · Draft {fixtureDraftId(draftSourceId)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FixtureField label="ชื่อลูกค้า" value={draft.customerName} onChange={(value) => setDraft((current) => current ? { ...current, customerName: value } : current)} />
            <FixtureField label="ทะเบียน" value={draft.plate} onChange={(value) => setDraft((current) => current ? { ...current, plate: value } : current)} />
            <FixtureField label="ราคามาตรฐาน / ราคาตั้งขาย" value={draft.salePrice} onChange={(value) => setDraft((current) => current ? { ...current, salePrice: value } : current)} />
            <FixtureField label="ราคาขายใหม่ (ต้องตรวจสอบ)" value={draft.finalPrice} onChange={(value) => setDraft((current) => current ? { ...current, finalPrice: value } : current)} placeholder="ยังไม่คัดลอก" />
            <FixtureField label="ประเภทการชำระเงิน" value={draft.paymentType} onChange={(value) => setDraft((current) => current ? { ...current, paymentType: value } : current)} placeholder="กรุณาเลือกใหม่" />
            <FixtureField label="วันที่ส่งมอบ" value={draft.deliveryDate} onChange={(value) => setDraft((current) => current ? { ...current, deliveryDate: value } : current)} placeholder="กรุณาระบุใหม่" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setDraft(null); setViewing(DUPLICATE_UX_FIXTURE_REPORTS[0]); }} className="min-h-11 rounded-lg border border-line px-4 font-bold text-white">ยกเลิก Draft</button>
            <button type="button" data-testid="fixture-draft-save" onClick={() => checkFixture(draft)} className="min-h-11 rounded-lg bg-brand px-4 font-bold text-ink">ตรวจสอบก่อนสร้างรายงานใหม่</button>
          </div>
          <p className="text-xs text-muted">Fixture นี้ไม่เรียก Sales Report POST และไม่สร้าง Booking Delivery</p>
        </div>
      ) : null}

      {dialog ? (
        <div data-testid="duplicate-dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-dialog-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-400/40 bg-[#111827] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-amber-200"><AlertTriangle size={20} /><h3 id="duplicate-dialog-title" className="font-black">พบทะเบียนนี้ในรายงานขายเดิม</h3></div>
                <p className="mt-2 text-xl font-black text-white">{dialog.plate}</p>
                <p className="text-sm text-muted">พบรายงานขายเดิม {dialog.matches.length} รายการ</p>
              </div>
              <button type="button" aria-label="ปิด" onClick={() => setDialog(null)} className="rounded-lg p-2 text-muted hover:bg-white/10"><X size={20} /></button>
            </div>
            <div className="mt-4 space-y-2">
              {dialog.matches.map((match) => (
                <div key={match.id} className="rounded-lg border border-line bg-panel p-3 text-sm">
                  <p className="font-bold text-white">{match.customerName} · {match.plate}</p>
                  <p className="mt-1 text-muted">{displayDate(match.createdAt)} · {match.saleName} · {match.status}</p>
                  <p className="mt-1 text-xs text-muted">{match.id}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-200">หากเป็นการขายครั้งใหม่ สามารถเริ่มรายงานใหม่ได้ ข้อมูลเดิมจะไม่ถูกแก้ไข</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button type="button" data-testid="duplicate-view-existing" onClick={() => { setViewing(dialog.matches[0]); setDraft(null); setDialog(null); }} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 font-bold text-white"><Eye size={17} />ดูรายงานเดิม</button>
              <button type="button" data-testid="duplicate-cancel" onClick={() => setDialog(null)} className="min-h-11 rounded-lg border border-line px-3 font-bold text-white">ยกเลิก</button>
              <button type="button" data-testid="duplicate-create-new" onClick={() => startFrom(dialog.matches[0])} className="min-h-11 rounded-lg bg-brand px-3 font-bold text-ink">สร้างรายงานใหม่</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FixtureField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-1 text-sm font-bold text-slate-200"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 rounded-lg border border-line bg-black/20 px-3 font-normal text-white outline-none focus:border-brand" /></label>;
}
