"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import type { DownloadLibraryItem } from "@/lib/documents/download-library";

type LibraryItem = Omit<DownloadLibraryItem, "storagePath" | "createdBy">;
const categories = ["เอกสารทั่วไป", "สัญญา", "ไฟแนนซ์", "งานทะเบียน", "แบบฟอร์มบริษัท", "อื่น ๆ"];

export function DocumentLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/documents/library", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลดรายการเอกสารไม่สำเร็จ");
    setItems(data.items || []);
    setCanManage(Boolean(data.canManage));
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "โหลดเอกสารไม่สำเร็จ")).finally(() => setLoading(false));
  }, [refresh]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.title, item.category, item.description, item.fileName].join(" ").toLocaleLowerCase().includes(normalized));
  }, [items, query]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !title.trim() || working) return;
    setError("");
    setMessage("");
    setWorking(true);
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 3 MB");
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim());
      form.append("category", category);
      form.append("description", description.trim());
      const response = await fetch("/api/documents/library", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "อัปโหลดไม่สำเร็จ");
      await refresh();
      setTitle("");
      setDescription("");
      setFile(null);
      setUploadOpen(false);
      setMessage("เพิ่มเอกสารเรียบร้อยแล้ว พนักงานสามารถดาวน์โหลดได้");
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  }

  async function remove(item: LibraryItem) {
    if (working || !window.confirm(`ลบเอกสาร “${item.title}” ออกจากคลังใช่ไหม?`)) return;
    setError("");
    setMessage("");
    setWorking(true);
    try {
      const response = await fetch(`/api/documents/library/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ลบไฟล์ไม่สำเร็จ");
      await refresh();
      setMessage("ลบเอกสารแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไฟล์ไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-1">
      <div className="rounded-2xl border border-line bg-[#121318] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <FileText size={20} className="text-brand" /> คลังเอกสารดาวน์โหลด
            </h2>
            <p className="mt-1 text-sm text-soft">ไฟล์กลางสำหรับพนักงาน · PDF / Word / Excel / รูปภาพ</p>
          </div>
          {canManage && (
            <button type="button" onClick={() => setUploadOpen((current) => !current)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-black text-ink">
              <Plus size={18} /> {uploadOpen ? "ปิดแบบฟอร์ม" : "เพิ่มเอกสาร"}
            </button>
          )}
        </div>

        {(error || message) && (
          <div role={error ? "alert" : "status"} className={`mb-4 rounded-lg border px-3 py-3 text-sm font-bold ${error ? "border-red-400/50 text-red-200" : "border-brand/40 text-brand"}`}>
            {error || message}
          </div>
        )}

        {uploadOpen && canManage && (
          <form onSubmit={upload} className="mb-5 grid gap-3 rounded-xl border border-brand/30 bg-[#090b0f] p-4">
            <p className="flex items-center gap-2 font-black text-brand"><Upload size={17} /> เพิ่มไฟล์สำหรับดาวน์โหลด (ผู้ดูแล)</p>
            <label className="grid gap-1 text-sm font-bold text-white">
              ชื่อเอกสาร
              <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)}
                placeholder="เช่น ใบสมัครไฟแนนซ์นิติบุคคล" className="min-h-11 rounded-lg border border-line bg-[#121318] px-3 text-white" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-white">
              หมวดหมู่
              <select value={category} onChange={(event) => setCategory(event.target.value)}
                className="min-h-11 rounded-lg border border-line bg-[#121318] px-3 text-white">
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-white">
              คำอธิบาย (ไม่บังคับ)
              <input maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)}
                placeholder="ระบุว่าใช้เอกสารนี้เมื่อใด" className="min-h-11 rounded-lg border border-line bg-[#121318] px-3 text-white" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-white">
              เลือกไฟล์ (สูงสุด 3 MB)
              <input type="file" required accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="min-h-11 w-full rounded-lg border border-line bg-[#121318] p-3 text-white file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:font-bold file:text-ink" />
            </label>
            <button type="submit" disabled={working || !file || !title.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-black text-ink disabled:opacity-50">
              {working ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} อัปโหลดเอกสาร
            </button>
          </form>
        )}

        <label className="mb-4 flex min-h-12 items-center gap-2 rounded-lg border border-line bg-[#090b0f] px-3 text-soft">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อเอกสาร / หมวดหมู่ / ชื่อไฟล์"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-soft" />
        </label>

        {loading ? (
          <div className="py-8 text-center text-sm text-soft"><Loader2 className="mx-auto mb-2 animate-spin" />กำลังโหลดรายการเอกสาร</div>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-7 text-center text-sm text-soft">
            {items.length ? "ไม่พบเอกสารที่ค้นหา" : "ยังไม่มีไฟล์เพิ่มเติมในคลังเอกสาร"}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-xl border border-line bg-[#090b0f] p-4">
                <p className="text-xs font-black tracking-wide text-brand">{item.category}</p>
                <h3 className="mt-1 font-black text-white">{item.title}</h3>
                <p className="mt-1 min-h-9 text-sm text-soft">{item.description || item.fileName}</p>
                <p className="mt-2 truncate text-xs text-soft">{item.fileName} · {(item.size / 1024).toFixed(0)} KB</p>
                <div className="mt-3 flex gap-2">
                  <a href={`/api/documents/library/${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-line px-3 text-sm font-bold text-white">
                    <Eye size={16} /> ดูไฟล์
                  </a>
                  <a href={`/api/documents/library/${encodeURIComponent(item.id)}?download=1`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-brand px-3 text-sm font-black text-ink">
                    <Download size={16} /> ดาวน์โหลด
                  </a>
                </div>
                {canManage && (
                  <button type="button" disabled={working} onClick={() => remove(item)}
                    className="mt-3 flex min-h-9 items-center gap-1 text-xs font-bold text-red-300 disabled:opacity-50">
                    <Trash2 size={14} /> ลบเอกสาร
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
