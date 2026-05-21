import type { Metadata } from "next";
import { LocationCard, SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { listLocations } from "@/lib/site/service";
import { siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "สถานที่จอดรถ",
  description: "สถานที่จอดรถ BIG CAR RDD โกดังบางนาและโกดังเทพารักษ์ กรุณาโทรนัดก่อนเข้าชมรถ",
  path: "/locations"
});

export default async function LocationsPage() {
  const locations = await listLocations();
  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading eyebrow="Locations" title="สถานที่จอดรถ" subtitle="รถแต่ละคันอาจอยู่คนละโกดัง กรุณาโทรนัดก่อนเข้าชมเพื่อยืนยันสถานที่และสถานะรถ" />
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((location) => (
            <LocationCard key={location.key} name={location.name} description={location.description} mapUrl={location.mapUrl} />
          ))}
        </div>
      </SiteSection>
    </SiteShell>
  );
}
