"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  filterThaiAddressOptions,
  findDistrict,
  findProvince,
  loadThaiAddressDataset,
  selectThaiDistrict,
  selectThaiProvince,
  thaiAddressLabels,
  validateThaiAddressSelection,
  type ThaiAddressDataset,
  type ThaiAddressValue
} from "@/lib/documents-v2/thai-address";

type NamedOption = { id: string; name: string };

function SearchableAddressCombobox({
  label,
  value,
  options,
  disabled,
  onSelect
}: {
  label: string;
  value: string;
  options: NamedOption[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => filterThaiAddressOptions(options, query), [options, query]);

  useEffect(() => setQuery(value), [value]);

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-xs text-gray-300">{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        disabled={disabled}
        placeholder={disabled ? `เลือก${label.replace(" / ", "/")}ก่อน` : `ค้นหา${label}`}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && filtered.length === 1) {
            event.preventDefault();
            onSelect(filtered[0].name);
            setQuery(filtered[0].name);
            setOpen(false);
          }
        }}
        className="min-h-11 w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
      />
      {open && !disabled ? (
        <div id={`${id}-options`} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded border border-white/15 bg-gray-950 p-1 shadow-2xl">
          {filtered.length ? filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.name === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option.name);
                setQuery(option.name);
                setOpen(false);
              }}
              className="block min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-emerald-500/15 focus:bg-emerald-500/15"
            >
              {option.name}
            </button>
          )) : <p className="px-3 py-3 text-xs text-gray-400">ไม่พบรายการที่ตรงกัน</p>}
        </div>
      ) : null}
    </div>
  );
}

export function ThaiAddressSelector({ value, onChange }: { value: ThaiAddressValue; onChange: (value: ThaiAddressValue) => void }) {
  const [dataset, setDataset] = useState<ThaiAddressDataset | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    loadThaiAddressDataset().then((next) => {
      if (active) setDataset(next);
    }).catch(() => {
      if (active) setLoadError("โหลดรายการที่อยู่ไม่สำเร็จ ใช้โหมดกรอกเองได้");
    });
    return () => { active = false; };
  }, []);

  const province = dataset ? findProvince(dataset, value.province) : undefined;
  const district = dataset ? findDistrict(dataset, value.province, value.district) : undefined;
  const labels = thaiAddressLabels(value.province);
  const validation = dataset ? validateThaiAddressSelection(dataset, value) : null;
  const hasHistoricalValue = Boolean(value.province || value.district || value.subdistrict);

  return (
    <fieldset className="rounded border border-emerald-400/20 bg-emerald-500/5 p-3">
      <legend className="px-1 text-sm font-semibold text-emerald-100">ที่อยู่ตามเขตการปกครอง</legend>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="รูปแบบการกรอกที่อยู่">
        <button type="button" onClick={() => onChange({ ...value, mode: "canonical" })} className={`min-h-10 rounded px-3 py-2 text-xs ${value.mode === "canonical" ? "bg-emerald-500 font-semibold text-black" : "border border-white/15"}`}>เลือกจากรายการ</button>
        <button type="button" onClick={() => onChange({ ...value, mode: "manual" })} className={`min-h-10 rounded px-3 py-2 text-xs ${value.mode === "manual" ? "bg-amber-300 font-semibold text-black" : "border border-white/15"}`}>กรอกเอง</button>
      </div>

      {value.mode === "manual" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ["province", "จังหวัด"],
            ["district", labels.district],
            ["subdistrict", labels.subdistrict]
          ].map(([key, label]) => (
            <label key={key} className="block text-xs text-gray-300">
              {label}
              <input value={value[key as "province" | "district" | "subdistrict"]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className="mt-1 min-h-11 w-full rounded bg-black/40 px-3 py-2 text-sm" />
            </label>
          ))}
        </div>
      ) : dataset ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SearchableAddressCombobox label="จังหวัด" value={value.province} options={dataset.provinces} onSelect={(next) => onChange(selectThaiProvince(value, next))} />
          <SearchableAddressCombobox label={labels.district} value={value.district} options={province?.districts || []} disabled={!province} onSelect={(next) => onChange(selectThaiDistrict(value, next))} />
          <SearchableAddressCombobox label={labels.subdistrict} value={value.subdistrict} options={district?.subdistricts || []} disabled={!district} onSelect={(next) => onChange({ ...value, subdistrict: next })} />
        </div>
      ) : <p className="text-xs text-gray-400">กำลังโหลดรายการจังหวัด อำเภอ และตำบล...</p>}

      {loadError ? <p className="mt-2 text-xs text-amber-200">{loadError}</p> : null}
      {value.mode === "canonical" && dataset && hasHistoricalValue && !validation?.valid ? (
        <p className="mt-2 text-xs text-amber-200">ข้อมูลเดิมยังไม่ตรงกับรายการมาตรฐาน ระบบเก็บข้อความเดิมไว้ กรุณาเลือกข้อมูลใหม่หรือใช้ “กรอกเอง”</p>
      ) : null}
      {value.mode === "manual" ? <p className="mt-2 text-xs text-gray-400">ข้อความที่กรอกเองใช้เฉพาะเอกสารนี้ และสลับกลับมาเลือกจากรายการได้เสมอ</p> : null}
    </fieldset>
  );
}
