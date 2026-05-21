import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CarCard, SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { siteConfig } from "@/lib/site/config";
import { formatBaht, formatMileage, maskVin } from "@/lib/site/format";
import { getLocationName, getPublicCarBySlug, getRelatedCars, listPublicCars } from "@/lib/site/service";
import { breadcrumbJsonLd, carProductJsonLd, siteMetadata } from "@/lib/site/seo";

type CarDetailProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  const cars = await listPublicCars();
  return cars.map((car) => ({ slug: car.slug }));
}

export async function generateMetadata({ params }: CarDetailProps): Promise<Metadata> {
  const car = await getPublicCarBySlug(params.slug);
  if (!car) return siteMetadata({ title: "ไม่พบรถ", description: "ไม่พบข้อมูลรถ", path: `/cars/${params.slug}` });
  return siteMetadata({
    title: car.seoTitle,
    description: car.seoDescription,
    path: `/cars/${car.slug}`,
    image: car.coverImage
  });
}

export default async function CarDetailPage({ params }: CarDetailProps) {
  const car = await getPublicCarBySlug(params.slug);
  if (!car) notFound();
  const related = await getRelatedCars(car);

  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(carProductJsonLd(car)) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd([
            { name: "หน้าแรก", path: "/showroom" },
            { name: "รถทั้งหมด", path: "/cars" },
            { name: `${car.brand} ${car.model}`, path: `/cars/${car.slug}` }
          ]))
        }}
      />
      <SiteSection className="pt-6">
        <div className="mb-5 text-sm text-white/55">
          <Link href="/showroom">หน้าแรก</Link> / <Link href="/cars">รถทั้งหมด</Link> / {car.brand} {car.model}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045]">
              <img src={car.coverImage} alt={`${car.brand} ${car.model}`} className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {car.images.slice(1, 5).map((image) => (
                <img key={image} src={image} alt={`${car.brand} ${car.model}`} className="aspect-[4/3] rounded-2xl border border-white/10 object-cover" loading="lazy" />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 lg:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-[#d6b66c]">Lease Return Car</p>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">{car.brand} {car.model}</h1>
            <p className="mt-4 text-4xl font-black text-[#f6df9d]">{formatBaht(car.price)}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Spec label="ปี" value={String(car.year)} />
              <Spec label="เลขไมล์" value={formatMileage(car.mileage)} />
              <Spec label="ทะเบียน" value={car.plate} />
              <Spec label="เลขตัวถัง" value={maskVin(car.vin)} />
              <Spec label="สถานที่จอด" value={getLocationName(car.location)} />
              <Spec label="สถานะ" value="พร้อมขาย" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {car.highlights.map((highlight) => <span key={highlight} className="rounded-full bg-[#d6b66c]/14 px-3 py-1 text-sm font-bold text-[#f6df9d]">{highlight}</span>)}
            </div>
            <p className="mt-6 leading-8 text-white/70">{car.description}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <a href={`tel:${siteConfig.phone}`} className="rounded-xl bg-[#d6b66c] px-4 py-4 text-center font-black text-[#101010]">โทร</a>
              <a href={siteConfig.lineUrl} className="rounded-xl border border-[#d6b66c]/50 px-4 py-4 text-center font-bold text-[#f6df9d]">LINE</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${siteConfig.baseUrl}/cars/${car.slug}`)}`} className="rounded-xl border border-white/12 px-4 py-4 text-center font-bold text-white">แชร์</a>
            </div>
          </div>
        </div>
      </SiteSection>
      <SiteSection>
        <SectionHeading title="รถใกล้เคียง" subtitle="รถหมดสัญญาเช่าที่อาจตรงกับความต้องการของคุณ" />
        <div className="grid gap-4 md:grid-cols-3">
          {related.map((item) => <CarCard key={item.id} car={item} />)}
        </div>
      </SiteSection>
    </SiteShell>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}
