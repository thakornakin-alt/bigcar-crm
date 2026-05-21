import type { Metadata } from "next";
import { SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { siteConfig } from "@/lib/site/config";
import { listLocations } from "@/lib/site/service";
import { siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "ติดต่อเรา",
  description: "ติดต่อ BIG CAR RDD โทร 091-778-5117 บิ๊ก หรือ LINE @bigcars ก่อนเข้าชมรถกรุณาโทรนัด",
  path: "/contact"
});

export default async function ContactPage() {
  const locations = await listLocations();
  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading eyebrow="Contact" title="ติดต่อ BIG CAR RDD" subtitle="ก่อนเข้าชมรถกรุณาโทรนัด เพื่อยืนยันรถ สถานที่จอด และเวลาที่สะดวก" />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
            <p className="text-sm text-white/55">โทร</p>
            <a href={`tel:${siteConfig.phone}`} className="mt-1 block text-3xl font-black text-[#f6df9d]">{siteConfig.phone}</a>
            <p className="mt-4 text-sm text-white/55">ผู้ติดต่อ</p>
            <p className="mt-1 text-xl font-black">{siteConfig.contactName}</p>
            <p className="mt-4 text-sm text-white/55">LINE</p>
            <a href={siteConfig.lineUrl} className="mt-1 inline-flex rounded-xl bg-[#d6b66c] px-4 py-3 font-black text-[#101010]">{siteConfig.lineId}</a>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {locations.map((location) => (
              <a key={location.key} href={location.mapUrl} target="_blank" rel="noreferrer" className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
                <p className="text-xl font-black">{location.name}</p>
                <p className="mt-3 leading-7 text-white/65">{location.description}</p>
                <span className="mt-4 inline-flex font-bold text-[#f6df9d]">เปิดแผนที่</span>
              </a>
            ))}
          </div>
        </div>
      </SiteSection>
    </SiteShell>
  );
}
