import { mockArticles, mockCars, siteLocations } from "./data";
import type { PublicCar, PublicCarStatus, SiteLocationKey } from "./types";

export type CarFilters = {
  brand?: string;
  model?: string;
  location?: SiteLocationKey | "";
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxMileage?: number;
  status?: PublicCarStatus | "all";
};

export async function listPublicCars(filters: CarFilters = {}) {
  const cars = mockCars
    .filter((car) => car.status !== "hidden")
    .filter((car) => !filters.status || filters.status === "all" || car.status === filters.status)
    .filter((car) => !filters.brand || car.brand.toLowerCase() === filters.brand.toLowerCase())
    .filter((car) => !filters.model || car.model.toLowerCase().includes(filters.model.toLowerCase()))
    .filter((car) => !filters.location || car.location === filters.location)
    .filter((car) => !filters.minPrice || car.price >= filters.minPrice)
    .filter((car) => !filters.maxPrice || car.price <= filters.maxPrice)
    .filter((car) => !filters.minYear || car.year >= filters.minYear)
    .filter((car) => !filters.maxYear || car.year <= filters.maxYear)
    .filter((car) => !filters.maxMileage || car.mileage <= filters.maxMileage);

  return cars.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listFeaturedCars() {
  return (await listPublicCars({ status: "available" })).slice(0, 3);
}

export async function getPublicCarBySlug(slug: string) {
  return mockCars.find((car) => car.slug === slug && car.status !== "hidden") || null;
}

export async function getRelatedCars(car: PublicCar) {
  return (await listPublicCars({ status: "available" }))
    .filter((item) => item.id !== car.id && (item.brand === car.brand || item.location === car.location))
    .slice(0, 3);
}

export async function listLocations() {
  return siteLocations;
}

export function getLocationName(key: SiteLocationKey) {
  return siteLocations.find((location) => location.key === key)?.name || key;
}

export async function listArticles() {
  return mockArticles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getArticleBySlug(slug: string) {
  return mockArticles.find((article) => article.slug === slug) || null;
}

export async function listCarFilterOptions() {
  const cars = await listPublicCars();
  return {
    brands: Array.from(new Set(cars.map((car) => car.brand))).sort(),
    locations: siteLocations,
    years: Array.from(new Set(cars.map((car) => car.year))).sort((a, b) => b - a)
  };
}
