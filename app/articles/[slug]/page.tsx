import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SectionHeading, SiteSection, SiteShell } from "@/app/components/site";
import { getArticleBySlug, listArticles } from "@/lib/site/service";
import { siteMetadata } from "@/lib/site/seo";

type ArticlePageProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  const articles = await listArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return siteMetadata({ title: "ไม่พบบทความ", description: "ไม่พบบทความ", path: `/articles/${params.slug}` });
  return siteMetadata({
    title: article.title,
    description: article.description,
    path: `/articles/${article.slug}`,
    image: article.coverImage
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  return (
    <SiteShell>
      <SiteSection className="pt-8">
        <SectionHeading eyebrow="Article" title={article.title} subtitle={article.description} />
        <div className="relative mb-8 aspect-[16/8] overflow-hidden rounded-3xl border border-white/10">
          <Image src={article.coverImage} alt={article.title} fill priority sizes="100vw" className="object-cover" />
        </div>
        <article className="mx-auto max-w-3xl space-y-8">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-black">{section.heading}</h2>
              <p className="mt-3 leading-8 text-white/70">{section.body}</p>
            </section>
          ))}
        </article>
      </SiteSection>
    </SiteShell>
  );
}
