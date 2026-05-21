import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, Phone, ShieldCheck } from "lucide-react";
import { siteConfig, siteNavItems } from "@/lib/site/config";
import { formatBaht, formatMileage, statusLabel } from "@/lib/site/format";
import { getLocationName } from "@/lib/site/service";
import type { PublicCar } from "@/lib/site/types";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07080a] pb-20 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07080a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/showroom" className="leading-tight">
            <span className="block text-xs font-black uppercase tracking-[0.35em] text-[#d6b66c]">BIG CAR RDD</span>
            <span className="text-sm text-white/70">รถหมดสัญญาเช่า</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {siteNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href={`tel:${siteConfig.phone}`} className="hidden rounded-full border border-[#d6b66c]/50 px-4 py-2 text-sm font-bold text-[#f6df9d] sm:inline-flex">
              โทรหาบิ๊ก
            </a>
            <a href={siteConfig.lineUrl} className="rounded-full bg-[#d6b66c] px-4 py-2 text-sm font-black text-[#101010]">
              LINE
            </a>
          </div>
        </div>
      </header>
      {children}
      <SiteFooter />
      <StickyContactBar />
    </div>
  );
}

export function SiteSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-7xl px-4 py-10 sm:py-14 ${className}`}>{children}</section>;
}

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      {eyebrow && <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-[#d6b66c]">{eyebrow}</p>}
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-base leading-7 text-white/68">{subtitle}</p>}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1800&q=80"
          alt="รถหมดสัญญาเช่า BIG CAR RDD"
          className="h-full w-full object-cover opacity-42"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080a]/45 via-[#07080a]/70 to-[#07080a]" />
      </div>
      <div className="relative mx-auto grid min-h-[86vh] max-w-7xl content-end px-4 pb-14 pt-24">
        <div className="max-w-4xl">
          <p className="mb-4 inline-flex rounded-full border border-[#d6b66c]/45 bg-black/35 px-4 py-2 text-sm font-bold text-[#f6df9d]">
            ก่อนเข้าชมรถกรุณาโทรนัด
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            รถหมดสัญญาเช่า ไมล์แท้ เช็คประวัติได้
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/76">
            รถใช้งานจริงจากระบบเช่า ตรวจสอบที่มาได้ เห็นสภาพจริงก่อนตัดสินใจ ราคาดีและมีหลายรุ่นให้เลือก
          </p>
          <div className="mt-7 grid gap-3 sm:flex">
            <Link href="/cars" className="rounded-xl bg-[#d6b66c] px-5 py-4 text-center font-black text-[#101010]">
              ดูรถทั้งหมด
            </Link>
            <a href={`tel:${siteConfig.phone}`} className="rounded-xl border border-white/18 bg-white/10 px-5 py-4 text-center font-bold text-white">
              โทรหาบิ๊ก
            </a>
            <a href={siteConfig.lineUrl} className="rounded-xl border border-[#d6b66c]/50 px-5 py-4 text-center font-bold text-[#f6df9d]">
              แอด LINE
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustGrid() {
  const items = [
    "ไมล์แท้ 100%",
    "เข้าศูนย์ทุกระยะ",
    "เช็คประวัติได้",
    "เห็นรถจริงก่อนตัดสินใจ",
    "ราคาดี ต่ำกว่าตลาด",
    "มีหลายรุ่นให้เลือก"
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item} className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
          <ShieldCheck className="mb-3 text-[#d6b66c]" size={22} />
          <p className="font-bold text-white">{item}</p>
        </div>
      ))}
    </div>
  );
}

export function CarCard({ car, priority = false }: { car: PublicCar; priority?: boolean }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.3)]">
      <Link href={`/cars/${car.slug}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-white/5">
          <img src={car.coverImage} alt={`${car.brand} ${car.model} ${car.year}`} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-[#d6b66c]/14 px-3 py-1 text-xs font-black text-[#f6df9d]">{statusLabel(car.status)}</span>
            <span className="text-xs text-white/52">{getLocationName(car.location)}</span>
          </div>
          <Link href={`/cars/${car.slug}`} className="line-clamp-2 text-xl font-black text-white hover:text-[#f6df9d]">
            {car.brand} {car.model}
          </Link>
          <p className="mt-2 text-sm text-white/60">ปี {car.year} • {formatMileage(car.mileage)}</p>
        </div>
        <p className="text-2xl font-black text-[#f6df9d]">{formatBaht(car.price)}</p>
        <div className="grid grid-cols-3 gap-2">
          <Link href={`/cars/${car.slug}`} className="rounded-lg bg-white/10 px-3 py-3 text-center text-sm font-bold text-white">รายละเอียด</Link>
          <a href={`tel:${siteConfig.phone}`} className="rounded-lg border border-white/12 px-3 py-3 text-center text-sm font-bold text-white">โทร</a>
          <a href={siteConfig.lineUrl} className="rounded-lg bg-[#d6b66c] px-3 py-3 text-center text-sm font-black text-[#101010]">LINE</a>
        </div>
      </div>
    </article>
  );
}

export function LocationCard({ name, description, mapUrl }: { name: string; description: string; mapUrl: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <MapPin className="mb-3 text-[#d6b66c]" />
      <h3 className="text-xl font-black">{name}</h3>
      <p className="mt-2 leading-7 text-white/65">{description}</p>
      <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl border border-[#d6b66c]/50 px-4 py-3 font-bold text-[#f6df9d]">
        เปิดแผนที่
      </a>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-black tracking-[0.2em] text-[#d6b66c]">BIG CAR RDD</p>
          <p className="mt-3 leading-7 text-white/62">รถหมดสัญญาเช่า ไมล์แท้ เช็คประวัติได้ ก่อนเข้าชมรถกรุณาโทรนัด</p>
        </div>
        <div>
          <p className="font-bold text-white">ติดต่อ</p>
          <p className="mt-3 text-white/65">โทร {siteConfig.phone} {siteConfig.contactName}</p>
          <p className="mt-1 text-white/65">LINE {siteConfig.lineId}</p>
        </div>
        <div>
          <p className="font-bold text-white">เมนู</p>
          <div className="mt-3 grid gap-2 text-white/62">
            {siteNavItems.slice(1, 5).map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          </div>
        </div>
        <div>
          <p className="font-bold text-white">หมายเหตุ</p>
          <p className="mt-3 leading-7 text-white/62">ข้อมูลรถอาจเปลี่ยนแปลง กรุณาติดต่อเพื่อยืนยันสภาพ ราคา และสถานที่จอดก่อนเข้าชม</p>
        </div>
      </div>
    </footer>
  );
}

function StickyContactBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07080a]/94 p-3 backdrop-blur lg:hidden">
      <div className="grid grid-cols-2 gap-2">
        <a href={`tel:${siteConfig.phone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 font-black text-white">
          <Phone size={18} /> โทร
        </a>
        <a href={siteConfig.lineUrl} className="flex min-h-12 items-center justify-center rounded-xl bg-[#d6b66c] font-black text-[#101010]">
          LINE
        </a>
      </div>
    </div>
  );
}
