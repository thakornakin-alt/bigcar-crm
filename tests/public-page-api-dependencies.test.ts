import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicPageFiles = [
  "app/page.tsx",
  "app/cars/page.tsx",
  "app/cars/[slug]/page.tsx",
  "app/articles/page.tsx",
  "app/articles/[slug]/page.tsx",
  "app/contact/page.tsx",
  "app/showroom/page.tsx",
  "app/locations/page.tsx",
  "app/why-us/page.tsx",
  "app/lease-return-cars/page.tsx",
  "app/components/site.tsx",
  "lib/site/service.ts"
];

test("public website pages do not depend on protected CRM APIs", async () => {
  const dependencies = new Set<string>();
  for (const file of publicPageFiles) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/\/api\/[a-zA-Z0-9_?=/${}.-]+/g)) dependencies.add(match[0]);
  }
  assert.deepEqual([...dependencies].sort(), ["/api/auth/login", "/api/auth/me"]);
});
