import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  getDocumentImageFileNames,
  getDocumentImagePageNumbers,
  shareDocumentImageFiles
} from "../lib/documents-v2/image-share.ts";

test("only power and transfer documents select exactly two final PDF pages", () => {
  assert.deepEqual(getDocumentImagePageNumbers("power-of-attorney", 2), [1, 2]);
  assert.deepEqual(getDocumentImagePageNumbers("transport-transfer-request", 2), [1, 2]);
  assert.throws(() => getDocumentImagePageNumbers("power-of-attorney", 1), /2 หน้าพอดี/);
  assert.throws(() => getDocumentImagePageNumbers("transport-transfer-request", 3), /2 หน้าพอดี/);
  assert.deepEqual(getDocumentImagePageNumbers("contract-field", 5), [1]);
  assert.deepEqual(getDocumentImagePageNumbers("temporary-receipt", 2), [1]);
});

test("two-page filenames are distinct while other templates retain their existing filename", () => {
  assert.deepEqual(
    getDocumentImageFileNames("power-of-attorney", "power-document.png", [1, 2]),
    ["power-document-page-1.png", "power-document-page-2.png"]
  );
  assert.deepEqual(
    getDocumentImageFileNames("transport-transfer-request", "transfer-document.png", [1, 2]),
    ["transfer-document-page-1.png", "transfer-document-page-2.png"]
  );
  assert.deepEqual(getDocumentImageFileNames("contract-field", "contract.png", [1]), ["contract.png"]);
});

test("multi-file share passes both PNG files in one navigator.share call", async () => {
  const files = [
    new File([new Uint8Array([1])], "document-page-1.png", { type: "image/png" }),
    new File([new Uint8Array([2])], "document-page-2.png", { type: "image/png" })
  ];
  const calls: File[][] = [];
  const shared = await shareDocumentImageFiles(
    {
      canShare: ({ files: offered }) => offered?.length === 2,
      share: async ({ files: offered }) => { calls.push(offered || []); }
    },
    files,
    "เอกสาร BIG CAR CRM"
  );
  assert.equal(shared, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map((file) => file.name), ["document-page-1.png", "document-page-2.png"]);
});

test("unsupported multi-file share returns false for the two-download fallback", async () => {
  const files = [
    new File([new Uint8Array([1])], "document-page-1.png", { type: "image/png" }),
    new File([new Uint8Array([2])], "document-page-2.png", { type: "image/png" })
  ];
  let shareCalled = false;
  const shared = await shareDocumentImageFiles(
    { canShare: () => false, share: async () => { shareCalled = true; } },
    files,
    "เอกสาร BIG CAR CRM"
  );
  assert.equal(shared, false);
  assert.equal(shareCalled, false);
});

test("Documents V2 renders selected final-PDF pages at the existing scale", async () => {
  const source = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(source, /const finalPdfBlob = await pdfResponse\.blob\(\)/);
  assert.match(source, /getDocumentImagePageNumbers\(templateId, finalPdf\.numPages\)/);
  assert.match(source, /for \(const pageNumber of pageNumbers\)/);
  assert.match(source, /finalPdf\.getPage\(pageNumber\)/);
  assert.match(source, /page\.getViewport\(\{ scale: 3 \}\)/);
  assert.match(source, /canvas\.toBlob\(resolve, "image\/png"\)/);
  assert.match(source, /downloadUrls\.forEach\(\(url, index\) => downloadObjectUrl\(url, fileNames\[index\]\)\)/);
});

test("Power of Attorney page 2 uses the original static raster and contains visible dark pixels", async () => {
  const source = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(source, /templateId === "power-of-attorney" && pageNumber === 2/);
  assert.match(source, /fetch\("\/document-templates\/power-of-attorney-original-page-2\.png"\)/);
  assert.match(source, /pageBlobs\.push\(await staticPageResponse\.blob\(\)\);\s*continue;/);

  const pngBytes = await readFile(new URL("../public/document-templates/power-of-attorney-original-page-2.png", import.meta.url));
  const image = await loadImage(pngBytes);
  assert.equal(image.width, 2479);
  assert.equal(image.height, 3502);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  let nonWhite = 0;
  let dark = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250) nonWhite += 1;
    if (pixels[index] < 128 && pixels[index + 1] < 128 && pixels[index + 2] < 128) dark += 1;
  }
  assert.ok(nonWhite > 150_000, `non-white pixels ${nonWhite}`);
  assert.ok(dark > 100_000, `dark pixels ${dark}`);
});
