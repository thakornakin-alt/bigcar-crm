export type SiteLocationKey = "bangna" | "thepharak";

export type PublicCarStatus = "available" | "reserved" | "sold" | "hidden";

export type PublicCar = {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  plate: string;
  vin: string;
  location: SiteLocationKey;
  coverImage: string;
  images: string[];
  highlights: string[];
  description: string;
  status: PublicCarStatus;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
};

export type SiteLocation = {
  key: SiteLocationKey;
  name: string;
  shortName: string;
  mapUrl: string;
  description: string;
};

export type Article = {
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  publishedAt: string;
  readingMinutes: number;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};
