import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared BIG CAR tokens use gold branding and explicit semantic status colors", async () => {
  const css = await source("app/globals.css");
  const tailwind = await source("tailwind.config.ts");
  assert.match(css, /--bigcar-bg:\s*#07080a/);
  assert.match(css, /--bigcar-gold:\s*#d6b66c/);
  assert.match(css, /--bigcar-gold-soft:\s*#f6df9d/);
  assert.match(css, /--status-success:\s*#34d399/);
  assert.match(css, /--status-warning:\s*#fbbf24/);
  assert.match(css, /--status-danger:\s*#fb7185/);
  assert.match(css, /--status-info:\s*#60a5fa/);
  assert.match(tailwind, /brand:\s*"#d6b66c"/);
  assert.match(tailwind, /success:\s*"#34d399"/);
  assert.doesNotMatch(tailwind, /brand:\s*"#22c55e"/);
});

test("visual system is scoped to authenticated CRM and public routes remain separate", async () => {
  const shell = await source("app/components/route-aware-shell.tsx");
  const css = await source("app/globals.css");
  assert.match(shell, /if \(isPublic\) return <>{children}<\/>/);
  assert.match(shell, /bigcar-crm-shell/);
  assert.match(css, /\.bigcar-crm-shell \.text-brand/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("Stock and Documents converge on shared tokens without changing their workflows", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /--stock-brand-gold:\s*var\(--bigcar-gold\)/);
  assert.match(css, /--documents-brand-gold:\s*var\(--bigcar-gold\)/);
  assert.match(css, /--stock-brand-gold-soft:\s*var\(--bigcar-gold-soft\)/);
  assert.match(css, /--documents-brand-gold-soft:\s*var\(--bigcar-gold-soft\)/);
});

test("shared components retain compact operational radius and accessible focus", async () => {
  const ui = await source("app/components/ui.tsx");
  const css = await source("app/globals.css");
  assert.match(ui, /rounded-\[16px\]/);
  assert.match(ui, /focus-visible:ring-2 focus-visible:ring-brand\/35/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /outline:\s*2px solid rgba\(214, 182, 108, 0\.72\)/);
});
