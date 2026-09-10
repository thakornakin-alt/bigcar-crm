import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}

async function startServer(dataDir, secret) {
  const port = await availablePort();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, BIG_CAR_DATA_DIR: dataDir, BIG_CAR_STORE_PROVIDER: "json", DATA_PROVIDER: "json", RDD_AUTH_ENFORCEMENT_ENABLED: "true", LINE_CHANNEL_SECRET: secret, LINE_CHANNEL_ACCESS_TOKEN: "test-token", LINE_TEST_DISABLE_SEND: "true" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(output);
    try { await fetch(`${baseUrl}/robots.txt`); return { baseUrl, child }; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error(`server timeout\n${output}`);
}

async function stop(child) {
  if (child.exitCode === null) child.kill();
  await new Promise((resolve) => { child.once("exit", resolve); setTimeout(resolve, 5000); });
}

test("LINE tracker updates the shared Workspace record and deduplicates webhook retries", { timeout: 90_000 }, async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "rdd-line-tracker-"));
  const secret = "line-test-secret";
  const record = {
    id: "CASE-3405", bookingId: "BK-3405", bookingReportId: "", salesReportId: "", plate: "กข 3405", customerName: "ลูกค้าทดสอบ",
    brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "",
    bookingPrice: "", salePrice: "", finalPrice: "", centralDiscount: "", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "", deliveryDate: "2026-09-20", deliveryLocation: "",
    garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "รอส่งมอบ",
    financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "",
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", recordVersion: 1, washStatus: "ordered_waiting", purchaseType: "cash", caseStatus: "waiting_delivery"
  };
  await writeFile(path.join(dataDir, "booking-delivery.json"), JSON.stringify({ records: [record] }));
  await writeFile(path.join(dataDir, "rdd-line-settings.json"), JSON.stringify({ groupId: "GROUP-TRACKER", enabled: true, reminderEnabled: false, reminderHourBangkok: 8 }));
  const server = await startServer(dataDir, secret);
  try {
    const body = JSON.stringify({ events: [{ type: "message", webhookEventId: "evt-3405-1", message: { type: "text", text: "งาน กข 3405 ล้างรถ ✅" }, source: { type: "group", groupId: "GROUP-TRACKER", userId: "LINE-USER" } }] });
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    for (let index = 0; index < 2; index += 1) {
      const response = await fetch(`${server.baseUrl}/api/line/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-line-signature": signature }, body });
      assert.equal(response.status, 200);
    }
    const saved = JSON.parse(await readFile(path.join(dataDir, "booking-delivery.json"), "utf8"));
    assert.equal(saved.records[0].washStatus, "completed");
    assert.equal(saved.records[0].recordVersion, 2);
    const activity = JSON.parse(await readFile(path.join(dataDir, "rdd-activity-log.json"), "utf8"));
    assert.equal(activity.events[0].source, "line");
    assert.equal(activity.events[0].metadata.lineUserId, "LINE-USER");
  } finally {
    await stop(server.child);
    await rm(dataDir, { recursive: true, force: true });
  }
});
