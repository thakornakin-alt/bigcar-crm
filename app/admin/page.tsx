"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, Save, Upload } from "lucide-react";

const sessionKey = "bigcar-rdd-site-admin";

type AdminCarDraft = {
  brand: string;
  model: string;
  year: string;
  price: string;
  mileage: string;
  plate: string;
  vin: string;
  location: string;
  status: string;
  highlights: string;
  description: string;
};

const emptyDraft: AdminCarDraft = {
  brand: "",
  model: "",
  year: "",
  price: "",
  mileage: "",
  plate: "",
  vin: "",
  location: "bangna",
  status: "available",
  highlights: "ไมล์แท้, เข้าศูนย์, เช็คประวัติได้",
  description: ""
};

export default function SiteAdminPage() {
  const [loggedIn, setLoggedIn] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(sessionKey) === "1");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [coverPreview, setCoverPreview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slugPreview = useMemo(() => {
    return [draft.brand, draft.model, draft.year]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/gi, "-")
      .replace(/^-|-$/g, "");
  }, [draft.brand, draft.model, draft.year]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/site-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      window.localStorage.setItem(sessionKey, "1");
      setLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("บันทึก Draft ในเครื่องแล้ว เวอร์ชันถัดไปจะต่อ Google Sheet/Drive แยกของเว็บขายรถ");
    window.localStorage.setItem("bigcar-rdd-car-draft", JSON.stringify({ ...draft, coverPreview, slug: slugPreview }));
  }

  function update<K extends keyof AdminCarDraft>(key: K, value: AdminCarDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#07080a] px-4 py-10 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.045] p-6">
          <Link href="/showroom" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[#f6df9d]">
            <ArrowLeft size={16} /> กลับหน้าเว็บ
          </Link>
          <h1 className="text-3xl font-black">Admin BIG CAR RDD</h1>
          <p className="mt-2 leading-7 text-white/62">เวอร์ชันแรกใช้รหัสผ่านเดียว และแยกจากระบบ CRM เดิม</p>
          {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-950/25 px-3 py-2 text-sm text-red-100">{error}</p>}
          <form onSubmit={login} className="mt-5 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="รหัสผ่าน Admin"
              className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white outline-none focus:border-[#d6b66c]"
            />
            <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d6b66c] font-black text-[#101010]">
              {loading && <Loader2 size={18} className="animate-spin" />}
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080a] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d6b66c]">Website Admin</p>
            <h1 className="mt-2 text-3xl font-black">จัดการรถ</h1>
            <p className="mt-1 text-white/60">Draft นี้ยังไม่แตะ Google Sheet CRM เดิม และเตรียมต่อ Sheet เว็บขายรถแยก</p>
          </div>
          <Link href="/showroom" className="rounded-xl border border-white/12 px-4 py-3 font-bold text-white">ดูหน้าเว็บ</Link>
        </div>
        {(message || error) && (
          <p className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/30 bg-red-950/25 text-red-100" : "border-[#d6b66c]/30 bg-[#d6b66c]/10 text-[#f6df9d]"}`}>
            {error || message}
          </p>
        )}
        <form onSubmit={saveDraft} className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminInput label="ยี่ห้อ" value={draft.brand} onChange={(value) => update("brand", value)} />
              <AdminInput label="รุ่น" value={draft.model} onChange={(value) => update("model", value)} />
              <AdminInput label="ปี" value={draft.year} onChange={(value) => update("year", value)} inputMode="numeric" />
              <AdminInput label="ราคา" value={draft.price} onChange={(value) => update("price", value)} inputMode="numeric" />
              <AdminInput label="เลขไมล์" value={draft.mileage} onChange={(value) => update("mileage", value)} inputMode="numeric" />
              <AdminInput label="ทะเบียน" value={draft.plate} onChange={(value) => update("plate", value)} />
              <AdminInput label="เลขตัวถัง" value={draft.vin} onChange={(value) => update("vin", value)} />
              <label>
                <span className="mb-1 block text-sm font-bold text-white/75">สถานที่จอด</span>
                <select value={draft.location} onChange={(event) => update("location", event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white">
                  <option value="bangna">โกดังบางนา</option>
                  <option value="thepharak">โกดังเทพารักษ์</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-bold text-white/75">สถานะ</span>
                <select value={draft.status} onChange={(event) => update("status", event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white">
                  <option value="available">พร้อมขาย</option>
                  <option value="reserved">จองแล้ว</option>
                  <option value="sold">ขายแล้ว</option>
                  <option value="hidden">ซ่อน</option>
                </select>
              </label>
              <AdminInput label="จุดเด่น คั่นด้วย ," value={draft.highlights} onChange={(value) => update("highlights", value)} />
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-bold text-white/75">รายละเอียด</span>
              <textarea value={draft.description} onChange={(event) => update("description", event.target.value)} rows={5} className="w-full rounded-xl border border-white/10 bg-[#0d0f13] px-3 py-3 text-white outline-none focus:border-[#d6b66c]" />
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button type="submit" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#d6b66c] font-black text-[#101010]"><Save size={18} /> Save Draft</button>
              <button type="button" onClick={() => setMessage("Preview พร้อมแล้ว ดูจากการ์ดด้านขวา")} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 font-bold text-white"><Eye size={18} /> Preview</button>
              <button type="button" onClick={() => setMessage("Publish จะต่อ Google Sheet เว็บขายรถแยกในเฟสถัดไป")} className="min-h-12 rounded-xl border border-[#d6b66c]/50 font-bold text-[#f6df9d]">Publish</button>
            </div>
          </section>
          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
              <p className="font-black">รูปภาพ</p>
              <label className="mt-3 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-center text-white/60">
                <Upload className="mb-2 text-[#d6b66c]" />
                เลือกรูปปก
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setCoverPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              <p className="mt-3 text-xs leading-6 text-white/50">เฟสถัดไปจะเพิ่ม compress, WebP, drag reorder และอัปโหลด Drive แยก</p>
            </section>
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045]">
              <div className="aspect-[4/3] bg-black/30">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-white/38">Preview รูป</div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xl font-black">{draft.brand || "ยี่ห้อ"} {draft.model || "รุ่น"}</p>
                <p className="mt-1 text-white/55">Slug: {slugPreview || "-"}</p>
                <p className="mt-3 text-2xl font-black text-[#f6df9d]">{draft.price ? `${Number(draft.price).toLocaleString("th-TH")} บาท` : "ราคา"}</p>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}

function AdminInput({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "text" | "numeric" }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-bold text-white/75">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white outline-none focus:border-[#d6b66c]" />
    </label>
  );
}
