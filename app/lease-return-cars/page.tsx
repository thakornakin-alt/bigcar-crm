import type { Metadata } from "next";
import { SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "รถหมดสัญญาเช่าคืออะไร",
  description: "อธิบายรถหมดสัญญาเช่า ข้อดี วิธีตรวจสอบ และสิ่งที่ควรรู้ก่อนซื้อรถมือสองประเภทนี้",
  path: "/lease-return-cars"
});

export default function LeaseReturnCarsPage() {
  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading
          eyebrow="Guide"
          title="รถหมดสัญญาเช่าคืออะไร"
          subtitle="รถที่สิ้นสุดรอบสัญญาเช่าหรือใช้งานองค์กร แล้วถูกนำกลับมาขายต่อ จุดเด่นคือมักมีเอกสารและประวัติการดูแลให้ตรวจสอบได้"
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            ["ที่มาชัดเจน", "รู้แหล่งที่มาของรถและตรวจสอบข้อมูลสำคัญได้ง่ายกว่ารถมือสองทั่วไป"],
            ["ไมล์สัมพันธ์กับการใช้งาน", "สามารถเทียบเลขไมล์กับประวัติการดูแลและสภาพจริงของรถ"],
            ["เห็นรถจริงก่อนซื้อ", "ควรนัดดูสภาพจริง ทดลองตรวจเอกสาร และคุยรายละเอียดก่อนตัดสินใจ"]
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-3 leading-7 text-white/66">{body}</p>
            </div>
          ))}
        </div>
      </SiteSection>
    </SiteShell>
  );
}
