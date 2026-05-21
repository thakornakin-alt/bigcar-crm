import Link from "next/link";
import type { Metadata } from "next";
import { CarCard, Hero, LocationCard, SectionHeading, SiteSection, SiteShell, TrustGrid } from "@/app/components/site";
import { siteConfig } from "@/lib/site/config";
import { listFeaturedCars, listLocations } from "@/lib/site/service";
import { organizationJsonLd, siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "รถหมดสัญญาเช่า ไมล์แท้ เช็คประวัติได้",
  description: "BIG CAR RDD รถหมดสัญญาเช่า ไมล์แท้ 100% เข้าศูนย์ทุกระยะ เช็คประวัติได้ ราคาดี ก่อนเข้าชมรถกรุณาโทรนัด",
  path: "/showroom"
});

export default async function ShowroomPage() {
  const [cars, locations] = await Promise.all([listFeaturedCars(), listLocations()]);

  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      <Hero />
      <SiteSection>
        <SectionHeading
          eyebrow="Lease Return Cars"
          title="รถหมดสัญญาเช่าที่ตรวจสอบที่มาได้"
          subtitle="เหมาะสำหรับคนที่อยากได้รถมือสองสภาพจริง มีประวัติให้เช็ค และต้องการราคาที่คุ้มกว่าตลาดทั่วไป"
        />
        <TrustGrid />
      </SiteSection>
      <SiteSection>
        <div className="flex items-end justify-between gap-4">
          <SectionHeading eyebrow="Recommended" title="รถแนะนำ" subtitle="ตัวอย่างรถพร้อมขายจากสต็อก เริ่มต้นด้วยข้อมูล mock และต่อ Google Sheet แยกภายหลังได้" />
          <Link href="/cars" className="hidden rounded-xl border border-[#d6b66c]/50 px-4 py-3 font-bold text-[#f6df9d] sm:inline-flex">
            ดูทั้งหมด
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cars.map((car, index) => <CarCard key={car.id} car={car} priority={index === 0} />)}
        </div>
      </SiteSection>
      <SiteSection>
        <SectionHeading eyebrow="Buying Steps" title="ขั้นตอนง่าย ๆ ก่อนซื้อ" />
        <div className="grid gap-3 md:grid-cols-4">
          {["เลือกคันที่สนใจ", "โทรนัดดูรถ", "ตรวจสภาพจริง", "คุยเงื่อนไขและจอง"].map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
              <span className="text-sm font-black text-[#d6b66c]">0{index + 1}</span>
              <p className="mt-4 text-lg font-black">{step}</p>
            </div>
          ))}
        </div>
      </SiteSection>
      <SiteSection>
        <SectionHeading eyebrow="Locations" title="นัดดูรถที่โกดัง" subtitle="กรุณาโทรนัดก่อนเข้าชมรถ เพื่อยืนยันว่ารถอยู่สาขาไหนและยังพร้อมดูอยู่หรือไม่" />
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((location) => (
            <LocationCard key={location.key} name={location.name} description={location.description} mapUrl={location.mapUrl} />
          ))}
        </div>
      </SiteSection>
      <SiteSection>
        <div className="rounded-3xl border border-[#d6b66c]/25 bg-[#d6b66c]/10 p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f6df9d]">Contact</p>
          <h2 className="mt-3 text-3xl font-black">อยากดูรถคันไหน โทรนัดบิ๊กก่อนได้เลย</h2>
          <p className="mt-3 text-white/70">โทร {siteConfig.phone} หรือแอด LINE {siteConfig.lineId}</p>
          <div className="mt-5 grid gap-3 sm:flex">
            <a href={`tel:${siteConfig.phone}`} className="rounded-xl bg-[#d6b66c] px-5 py-4 text-center font-black text-[#101010]">โทรหาบิ๊ก</a>
            <a href={siteConfig.lineUrl} className="rounded-xl border border-[#d6b66c]/50 px-5 py-4 text-center font-bold text-[#f6df9d]">แอด LINE</a>
          </div>
        </div>
      </SiteSection>
    </SiteShell>
  );
}
