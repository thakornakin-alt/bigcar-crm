import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site/config";
import { listArticles, listPublicCars } from "@/lib/site/service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cars, articles] = await Promise.all([listPublicCars(), listArticles()]);
  const staticPaths = [
    "/showroom",
    "/cars",
    "/lease-return-cars",
    "/why-us",
    "/locations",
    "/articles",
    "/contact"
  ];

  return [
    ...staticPaths.map((path) => ({
      url: `${siteConfig.baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "/showroom" ? 1 : 0.8
    })),
    ...cars.map((car) => ({
      url: `${siteConfig.baseUrl}/cars/${car.slug}`,
      lastModified: new Date(car.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.9
    })),
    ...articles.map((article) => ({
      url: `${siteConfig.baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7
    }))
  ];
}
