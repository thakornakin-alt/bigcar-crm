import type { Metadata } from "next";
import { CarCard, SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { listCarFilterOptions, listPublicCars } from "@/lib/site/service";
import { siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "รถทั้งหมด",
  description: "รวมรถหมดสัญญาเช่าพร้อมขายจาก BIG CAR RDD ไมล์แท้ เช็คประวัติได้ นัดดูรถก่อนตัดสินใจ",
  path: "/cars"
});

type CarsPageProps = {
  searchParams?: {
    brand?: string;
    location?: string;
    maxPrice?: string;
    year?: string;
  };
};

export default async function CarsPage({ searchParams }: CarsPageProps) {
  const [options, cars] = await Promise.all([
    listCarFilterOptions(),
    listPublicCars({
      brand: searchParams?.brand || undefined,
      location: searchParams?.location === "bangna" || searchParams?.location === "thepharak" ? searchParams.location : "",
      maxPrice: Number(searchParams?.maxPrice || 0) || undefined,
      minYear: Number(searchParams?.year || 0) || undefined,
      status: "available"
    })
  ]);

  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading
          eyebrow="Stock"
          title="รถหมดสัญญาเช่าพร้อมขาย"
          subtitle="ใช้ตัวกรองเบื้องต้นเพื่อคัดรถที่เหมาะกับงบและสถานที่จอด ก่อนโทรนัดดูรถจริง"
        />
        <form className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 md:grid-cols-4">
          <select name="brand" defaultValue={searchParams?.brand || ""} className="h-12 rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white">
            <option value="">ยี่ห้อทั้งหมด</option>
            {options.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
          <select name="location" defaultValue={searchParams?.location || ""} className="h-12 rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white">
            <option value="">สถานที่ทั้งหมด</option>
            {options.locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}
          </select>
          <select name="year" defaultValue={searchParams?.year || ""} className="h-12 rounded-xl border border-white/10 bg-[#0d0f13] px-3 text-white">
            <option value="">ปีทั้งหมด</option>
            {options.years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button className="h-12 rounded-xl bg-[#d6b66c] px-4 font-black text-[#101010]">กรองรถ</button>
        </form>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-white/60">พบ {cars.length.toLocaleString("th-TH")} คัน</p>
          <p className="text-sm text-white/60">ก่อนเข้าชมรถกรุณาโทรนัด</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cars.map((car, index) => <CarCard key={car.id} car={car} priority={index < 2} />)}
        </div>
        {!cars.length && <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-8 text-center text-white/65">ไม่พบรถตามเงื่อนไข</div>}
      </SiteSection>
    </SiteShell>
  );
}
