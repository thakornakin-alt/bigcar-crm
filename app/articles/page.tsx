import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { listArticles } from "@/lib/site/service";
import { siteMetadata } from "@/lib/site/seo";

export const metadata: Metadata = siteMetadata({
  title: "บทความรถมือสอง",
  description: "บทความ SEO เรื่องรถหมดสัญญาเช่า รถมือสองไมล์แท้ และวิธีตรวจสอบรถก่อนซื้อ",
  path: "/articles"
});

export default async function ArticlesPage() {
  const articles = await listArticles();
  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading eyebrow="Articles" title="บทความสำหรับคนซื้อรถมือสอง" subtitle="เนื้อหาที่ช่วยให้ลูกค้าเข้าใจรถหมดสัญญาเช่าและตัดสินใจได้มั่นใจขึ้น" />
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <Link key={article.slug} href={`/articles/${article.slug}`} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045]">
              <div className="relative aspect-[16/9]">
                <Image src={article.coverImage} alt={article.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              </div>
              <div className="p-5">
                <p className="text-xs font-bold text-[#d6b66c]">{article.readingMinutes} นาที</p>
                <h2 className="mt-2 text-2xl font-black">{article.title}</h2>
                <p className="mt-3 leading-7 text-white/65">{article.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </SiteSection>
    </SiteShell>
  );
}
