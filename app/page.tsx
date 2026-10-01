"use client";

import Link from "next/link";
import { BadgeCheck, Calculator, CarFront, ClipboardCheck, Phone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

const profileKey = "bigcar-sales-tools-profile";

export default function SalesToolsHomePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(profileKey);
      if (!raw) return;
      const profile = JSON.parse(raw);
      setName(profile?.name || "");
      setPhone(profile?.phone || "");
      setSaved(Boolean(profile?.name || profile?.phone));
    } catch {}
  }, []);

  function saveProfile() {
    try {
      window.localStorage.setItem(profileKey, JSON.stringify({ name: name.trim(), phone: phone.trim() }));
      setSaved(true);
    } catch {}
  }

  const tools = [
    { href: "/stock-export", title: "Stock", detail: "ค้นหา กรอง และทำภาพสต๊อกรถ", icon: CarFront },
    { href: "/calculator", title: "คำนวณค่างวด", detail: "คำนวณดาวน์ ยอดจัด ดอกเบี้ย และค่างวด", icon: Calculator },
    { href: "/approval-forms", title: "อนุมัติ", detail: "ค้นหารถและจัดการแบบฟอร์มอนุมัติ", icon: ClipboardCheck }
  ];

  return (
    <main className="min-h-screen bg-[#07080a] px-4 py-8 text-white">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand">BIG CAR</p>
        <h1 className="mt-2 text-3xl font-black">Sales Tools</h1>
        <p className="mt-2 text-sm leading-6 text-soft">Stock · คำนวณค่างวด · อนุมัติ — เข้าใช้งานได้โดยไม่ต้องสมัครบัญชี</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {tools.map(({ href, title, detail, icon: Icon }) => (
            <Link key={href} href={href} className="rounded-2xl border border-line bg-panel p-5 transition active:scale-[0.99]">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={22}/></span>
              <h2 className="mt-4 text-lg font-black">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-soft">{detail}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <UserRound className="text-brand" size={22}/>
            <div>
              <h2 className="font-black">ข้อมูลเซลส์</h2>
              <p className="text-xs text-soft">เก็บเฉพาะในเครื่องนี้ เพื่อใช้กับภาพ/เอกสารที่สร้างจากเว็บ</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-soft">ชื่อเซลส์</span>
              <input value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} placeholder="เช่น บิ๊ก ฐากร" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-[#0b0d11] px-4 text-sm font-bold outline-none focus:border-brand"/>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-soft">เบอร์โทร</span>
              <span className="mt-2 flex min-h-12 items-center gap-2 rounded-xl border border-line bg-[#0b0d11] px-4 focus-within:border-brand"><Phone size={16} className="text-brand"/><input value={phone} onChange={e=>{setPhone(e.target.value);setSaved(false)}} inputMode="tel" placeholder="08x-xxx-xxxx" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"/></span>
            </label>
          </div>
          <button type="button" onClick={saveProfile} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-black text-ink">
            {saved ? <BadgeCheck size={19}/> : null}{saved ? "บันทึกแล้ว" : "บันทึกข้อมูล"}
          </button>
        </div>
      </section>
    </main>
  );
}
