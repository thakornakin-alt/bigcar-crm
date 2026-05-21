import type { Metadata } from "next";
import { siteConfig } from "./config";
import type { PublicCar } from "./types";

type SeoInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
};

export function siteMetadata({ title, description, path = "", image }: SeoInput): Metadata {
  const url = `${siteConfig.baseUrl}${path}`;
  const fullTitle = title.includes(siteConfig.brandName) ? title : `${title} | ${siteConfig.brandName}`;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.brandName,
      locale: "th_TH",
      type: "website",
      images: image ? [{ url: image }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: image ? [image] : undefined
    }
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: siteConfig.brandName,
    telephone: siteConfig.phone,
    url: siteConfig.baseUrl,
    sameAs: [siteConfig.lineUrl],
    areaServed: "Bangkok Metropolitan Region"
  };
}

export function carProductJsonLd(car: PublicCar) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${car.brand} ${car.model} ${car.year}`,
    image: car.images,
    description: car.seoDescription,
    sku: car.plate,
    brand: {
      "@type": "Brand",
      name: car.brand
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "THB",
      price: car.price,
      availability: car.status === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteConfig.baseUrl}/cars/${car.slug}`
    }
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.baseUrl}${item.path}`
    }))
  };
}
