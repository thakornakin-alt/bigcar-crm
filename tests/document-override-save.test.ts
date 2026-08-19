import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  deleteDocumentV2Override,
  readDocumentV2Override,
  writeDocumentV2Override
} from "../lib/documents-v2/override-store.ts";

test("first Sales Contract override save creates an empty store and reloads safely", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bigcar-document-override-"));
  const previousProvider = process.env.BIG_CAR_STORE_PROVIDER;
  const previousDirectory = process.env.BIG_CAR_DATA_DIR;
  process.env.BIG_CAR_STORE_PROVIDER = "json";
  process.env.BIG_CAR_DATA_DIR = directory;
  try {
    assert.equal(await readDocumentV2Override("contract-field", "REPORT-FIRST"), null);
    const saved = await writeDocumentV2Override({
      templateId: "contract-field",
      reportId: "REPORT-FIRST",
      actorUserId: "USER-FIXTURE",
      data: {
        customerName: "ผู้ซื้อทดสอบ",
        idCard: "0123456789012",
        sellPrice: "504,000.50",
        discount: "-",
        rawUiOnly: "must-not-persist"
      },
      templateData: {}
    });
    assert.deepEqual(saved.data, {
      customerName: "ผู้ซื้อทดสอบ",
      idCard: "0123456789012",
      sellPrice: "504,000.50"
    });
    assert.deepEqual((await readDocumentV2Override("contract-field", "REPORT-FIRST"))?.data, saved.data);
    const rawStore = JSON.parse(await readFile(path.join(directory, "document-overrides-v2.json"), "utf8"));
    assert.equal(rawStore["contract-field::REPORT-FIRST"].data.idCard, "0123456789012");
    assert.equal(rawStore["contract-field::REPORT-FIRST"].data.sellPrice, "504,000.50");
    await deleteDocumentV2Override("contract-field", "REPORT-FIRST");
    assert.equal(await readDocumentV2Override("contract-field", "REPORT-FIRST"), null);
  } finally {
    if (previousProvider === undefined) delete process.env.BIG_CAR_STORE_PROVIDER;
    else process.env.BIG_CAR_STORE_PROVIDER = previousProvider;
    if (previousDirectory === undefined) delete process.env.BIG_CAR_DATA_DIR;
    else process.env.BIG_CAR_DATA_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});

test("malformed Sales Contract payload is rejected without creating a store entry", async () => {
  await assert.rejects(
    writeDocumentV2Override({
      templateId: "contract-field",
      reportId: "REPORT-BAD",
      actorUserId: "USER-FIXTURE",
      data: { sellPrice: "1..50" },
      templateData: {}
    }),
    /รูปแบบจำนวนเงินใน sellPrice ไม่ถูกต้อง/
  );
});
