import type { Metadata } from "next";
import { SectionHeading, SiteSection, SiteShell, TrustGrid } from "@/app/components/site";
import { siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "ทำไมต้องซื้อกับเรา",
  description: "เหตุผลที่ควรเลือก BIG CAR RDD สำหรับรถหมดสัญญาเช่า ไมล์แท้ เช็คประวัติได้ เห็นสภาพจริงก่อนตัดสินใจ",
  path: "/why-us"
});

export default function WhyUsPage() {
  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading
          eyebrow="Why BIG CAR RDD"
          title="ซื้อรถมือสองควรเริ่มจากความน่าเชื่อถือ"
          subtitle="เราเน้นรถที่ตรวจสอบได้ เห็นสภาพจริง และให้ลูกค้าตัดสินใจจากข้อมูลที่ชัดเจน"
        />
        <TrustGrid />
      </SiteSection>
    </SiteShell>
  );
}
