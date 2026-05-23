"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Car,
  Check,
  FileImage,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Radio,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  User,
  X
} from "lucide-react";
import type { Customer, CustomerInput } from "@/lib/types";

const blankForm: CustomerInput = {
  car: "",
  name: "",
  phone: "",
  note: ""
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerInput>(blankForm);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [detailForm, setDetailForm] = useState<CustomerInput>(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCustomers() {
    setError("");
    const data = await api<{ customers: Customer[] }>("/api/customers");
    setCustomers(data.customers);
  }

  useEffect(() => {
    loadCustomers()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;

    return customers.filter((customer) =>
      [customer.name, customer.car, customer.phone].some((value) => value.toLowerCase().includes(term))
    );
  }, [customers, query]);

  function updateForm(field: keyof CustomerInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateDetail(field: keyof CustomerInput, value: string) {
    setDetailForm((current) => ({ ...current, [field]: value }));
  }

  function openDetail(customer: Customer) {
    setSelected(customer);
    setDetailForm({
      car: customer.car,
      name: customer.name,
      phone: customer.phone,
      note: customer.note
    });
    setMessage("");
    setError("");
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api("/api/customers", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm(blankForm);
      await loadCustomers();
      setMessage("บันทึกลูกค้าเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setDetailSaving(true);
    setError("");
    setMessage("");

    try {
      await api(`/api/customers/${selected.rowIndex}`, {
        method: "PUT",
        body: JSON.stringify(detailForm)
      });
      await loadCustomers();
      setSelected(null);
      setMessage("อัปเดตข้อมูลเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    const confirmed = window.confirm(`ลบข้อมูลของ ${selected.name} ใช่ไหม?`);
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      await api(`/api/customers/${selected.rowIndex}`, { method: "DELETE" });
      await loadCustomers();
      setSelected(null);
      setMessage("ลบข้อมูลเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">บันทึกลูกค้า</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/crm"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <User size={18} className="text-brand" aria-hidden="true" />
            CRM v2
          </Link>
          <Link
            href="/booking-reports"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <FileText size={18} className="text-brand" aria-hidden="true" />
            รายงานจอง
          </Link>
          <Link
            href="/stock-import"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <Upload size={18} className="text-brand" aria-hidden="true" />
            Stock
          </Link>
          <Link
            href="/stock-export"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <FileImage size={18} className="text-brand" aria-hidden="true" />
            รูปสต็อก
          </Link>
          <Link
            href="/sales-reports"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <FileText size={18} className="text-brand" aria-hidden="true" />
            รายงานขาย
          </Link>
          <Link
            href="/report-history"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <History size={18} className="text-brand" aria-hidden="true" />
            ประวัติ
          </Link>
          <Link
            href="/approval-forms"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <MessageCircle size={18} className="text-brand" aria-hidden="true" />
            ฟอร์มอนุมัติ
          </Link>
          <Link
            href="/realtime-booking"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <Radio size={18} className="text-brand" aria-hidden="true" />
            Realtime จอง
          </Link>
          <Link
            href="/line-settings"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <MessageCircle size={18} className="text-brand" aria-hidden="true" />
            LINE
          </Link>
          <Link
            href="/settings"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <Settings size={18} className="text-brand" aria-hidden="true" />
            ตั้งค่า
          </Link>
          <Link
            href="/calculator"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
          >
            <Calculator size={18} className="text-brand" aria-hidden="true" />
            ค่างวด
          </Link>
        </div>
      </header>

      <section className="mb-4 rounded-lg border border-line bg-panel p-4 shadow-glow">
        <form onSubmit={handleAdd} className="space-y-3">
          <Field
            icon={<Car size={19} />}
            label="รถ"
            placeholder="Toyota Revo 2020"
            value={form.car}
            onChange={(value) => updateForm("car", value)}
            required
          />
          <Field
            icon={<User size={19} />}
            label="ชื่อลูกค้า"
            placeholder="ชื่อ / บริษัท"
            value={form.name}
            onChange={(value) => updateForm("name", value)}
            required
          />
          <Field
            icon={<Phone size={19} />}
            label="เบอร์โทร"
            placeholder="081-000-0000"
            value={form.phone}
            onChange={(value) => updateForm("phone", value)}
            required
            inputMode="tel"
          />
          <TextArea
            label="โน้ต"
            placeholder="แหล่งที่มา เงื่อนไข นัดหมาย รายละเอียดเพิ่มเติม"
            value={form.note}
            onChange={(value) => updateForm("note", value)}
          />
          <button
            type="submit"
            disabled={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-base font-bold text-ink"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            Save Customer
          </button>
        </form>
      </section>

      {(message || error) && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-red-400/40 bg-red-950/30 text-red-100"
              : "border-brand/40 bg-green-950/30 text-green-100"
          }`}
        >
          {error ? <X size={18} /> : <Check size={18} />}
          <span>{error || message}</span>
        </div>
      )}

      <section className="mb-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">รายชื่อลูกค้า</h2>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-soft">{customers.length} รายการ</span>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0d0f13] px-3">
          <Search size={20} className="text-soft" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อ รุ่นรถ หรือเบอร์"
            className="h-12 w-full bg-transparent text-white outline-none placeholder:text-[#6f7785]"
          />
        </label>
      </section>

      <section className="space-y-2">
        {loading ? (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-line bg-panel text-soft">
            <Loader2 size={22} className="mr-2 animate-spin" />
            Loading
          </div>
        ) : filteredCustomers.length ? (
          filteredCustomers.map((customer) => (
            <button
              key={`${customer.no}-${customer.rowIndex}`}
              onClick={() => openDetail(customer)}
              className="w-full rounded-lg border border-line bg-panel p-4 text-left transition hover:border-brand/60 active:scale-[0.99]"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">{customer.name}</p>
                  <p className="mt-1 truncate text-sm text-soft">{customer.car}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#1b2028] px-2.5 py-1 text-xs text-soft">#{customer.no}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#cfd5df]">
                <span>{customer.phone}</span>
                <span className="text-[#68707d]">/</span>
                <span>{customer.date}</span>
              </div>
              {customer.note && <p className="mt-2 line-clamp-2 text-sm text-[#9aa3b2]">{customer.note}</p>}
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-line bg-panel px-4 py-8 text-center text-soft">
            ไม่พบข้อมูลลูกค้า
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/65 px-3 pb-3 pt-12 backdrop-blur-sm sm:items-center sm:justify-center">
          <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-[#0d0f13] p-4 shadow-glow">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-soft">Customer #{selected.no}</p>
                <h2 className="mt-1 text-xl font-bold text-white">{selected.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <Field
                icon={<Car size={19} />}
                label="รถ"
                value={detailForm.car}
                onChange={(value) => updateDetail("car", value)}
                required
              />
              <Field
                icon={<User size={19} />}
                label="ชื่อลูกค้า"
                value={detailForm.name}
                onChange={(value) => updateDetail("name", value)}
                required
              />
              <Field
                icon={<Phone size={19} />}
                label="เบอร์โทร"
                value={detailForm.phone}
                onChange={(value) => updateDetail("phone", value)}
                required
                inputMode="tel"
              />
              <TextArea
                label="รายละเอียดเพิ่มเติม"
                value={detailForm.note}
                onChange={(value) => updateDetail("note", value)}
              />
              <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
                <button
                  type="submit"
                  disabled={detailSaving || deleting}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-bold text-ink"
                >
                  {detailSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Save
                </button>
                <button
                  type="button"
                  disabled={detailSaving || deleting}
                  onClick={handleDelete}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-400/40 bg-red-950/30 px-4 py-3 font-bold text-red-100"
                  aria-label="Delete customer"
                >
                  {deleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  required,
  inputMode
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <span className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-[#0b0d11] px-3 focus-within:border-brand">
        <span className="text-soft">{icon}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          className="h-12 w-full bg-transparent text-white outline-none placeholder:text-[#6f7785]"
        />
      </span>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#dce2eb]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="min-h-28 w-full resize-y rounded-lg border border-line bg-[#0b0d11] px-3 py-3 text-white outline-none placeholder:text-[#6f7785] focus:border-brand"
      />
    </label>
  );
}
