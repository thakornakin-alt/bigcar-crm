import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const secret = "rdd-phase3a-write-contract-secret-with-safe-length";

function token(role, id = `user-${role}`) {
  const now = Date.now();
  const user = { id, email: `${role}@example.test`, firstName: role, lastName: "Test", nickname: role, phone: "", lineId: "", lineQrUrl: "", avatarUrl: "", position: "", branch: "", role, locked: false, createdAt: "", updatedAt: "" };
  const payload = Buffer.from(JSON.stringify({ user, iat: now, exp: now + 120_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}

async function startServer(dataDir, editEnabled = true) {
  const port = await availablePort();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, AUTH_SECRET: secret, BIG_CAR_DATA_DIR: dataDir, BIG_CAR_STORE_PROVIDER: "json", DATA_PROVIDER: "json", RDD_AUTH_ENFORCEMENT_ENABLED: "true", RDD_WORKSPACE_READ_ONLY_ENABLED: "true", RDD_WORKSPACE_EDIT_ENABLED: String(editEnabled), RDD_ACTIVITY_V2_ENABLED: "true" },
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

async function patch(baseUrl, body, role) {
  return fetch(`${baseUrl}/api/booking-delivery-workspace`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(role ? { Cookie: `bigcar_sales_profile=${token(role)}` } : {}) },
    body: JSON.stringify(body)
  });
}

test("Phase 3A narrow write contract, roles, CAS, QA safety and activity", { timeout: 180_000 }, async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "rdd-phase3a-"));
  const original = { id: "CASE-1", bookingId: "BK-1", plate: "กข 1234", customerName: "ลูกค้า", status: "ยอดจอง", workflowStatus: "รอส่งมอบ", deliveryLocation: "", financeCaseNote: "เดิม", saleName: "เซลล์", ownerUserId: "owner-other", qaTestRecord: undefined, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", recordVersion: 1 };
  const qa = { ...original, id: "CASE-QA", bookingId: "BK-QA", plate: "QA", qaTestRecord: true };
  await writeFile(path.join(dataDir, "booking-delivery.json"), JSON.stringify({ records: [original, qa] }, null, 2));
  const server = await startServer(dataDir, true);
  try {
    const get = await fetch(`${server.baseUrl}/api/booking-delivery?scope=all`, { headers: { Cookie: `bigcar_sales_profile=${token("sales")}` } });
    const initial = await get.json();
    assert.equal(get.status, 200);
    assert.ok(initial.revision);

    await t.test("anonymous and viewer are rejected", async () => {
      assert.equal((await patch(server.baseUrl, { id: "CASE-1", expectedRevision: initial.revision, changes: { financeCaseNote: "ใหม่" } })).status, 401);
      assert.equal((await patch(server.baseUrl, { id: "CASE-1", expectedRevision: initial.revision, changes: { financeCaseNote: "ใหม่" } }, "viewer")).status, 403);
    });

    await t.test("readonly and unknown fields are rejected without mutation", async () => {
      for (const changes of [{ plate: "ปลอม" }, { qaTestRecord: true }, { unknown: "x" }]) {
        assert.equal((await patch(server.baseUrl, { id: "CASE-1", expectedRevision: initial.revision, changes }, "sales")).status, 400);
      }
      const stored = JSON.parse(await readFile(path.join(dataDir, "booking-delivery.json"), "utf8"));
      assert.equal(stored.records[0].plate, original.plate);
      assert.equal(stored.records[0].qaTestRecord, undefined);
    });

    let currentRevision = initial.revision;
    for (const role of ["sales", "admin", "super_admin"]) {
      await t.test(`${role} may update an allowlisted field regardless of owner`, async () => {
        const value = `หมายเหตุ ${role}`;
        const response = await patch(server.baseUrl, { id: "CASE-1", expectedRevision: currentRevision, changes: { financeCaseNote: value } }, role);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.record.financeCaseNote, value);
        assert.equal(body.record.plate, original.plate);
        assert.ok(body.activityEventId);
        currentRevision = body.revision;
      });
    }

    await t.test("stale revision returns 409 and cannot overwrite", async () => {
      const response = await patch(server.baseUrl, { id: "CASE-1", expectedRevision: initial.revision, changes: { financeCaseNote: "ข้อมูลเก่า" } }, "sales");
      assert.equal(response.status, 409);
      const stored = JSON.parse(await readFile(path.join(dataDir, "booking-delivery.json"), "utf8"));
      assert.equal(stored.records[0].financeCaseNote, "หมายเหตุ super_admin");
      assert.equal(stored.records[1].bookingId, qa.bookingId);
    });

    await t.test("QA record remains read-only", async () => {
      const response = await patch(server.baseUrl, { id: "CASE-QA", expectedRevision: currentRevision, changes: { deliveryLocation: "โกดังบางนา" } }, "admin");
      assert.equal(response.status, 403);
    });

    await t.test("activity actor comes from session and contains only safe changes", async () => {
      const activity = JSON.parse(await readFile(path.join(dataDir, "rdd-activity-log.json"), "utf8"));
      assert.equal(activity.events[0].actorUserId, "user-super_admin");
      assert.deepEqual(activity.events[0].metadata.changedFields, ["financeCaseNote"]);
      assert.equal(JSON.stringify(activity.events).includes("ลูกค้า"), false);
    });
  } finally {
    await stop(server.child);
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("edit feature flag disables the workspace write endpoint", { timeout: 120_000 }, async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "rdd-phase3a-off-"));
  await writeFile(path.join(dataDir, "booking-delivery.json"), JSON.stringify({ records: [] }));
  const server = await startServer(dataDir, false);
  try {
    const response = await patch(server.baseUrl, { id: "x", expectedRevision: "x", changes: { financeCaseNote: "x" } }, "admin");
    assert.equal(response.status, 403);
  } finally {
    await stop(server.child);
    await rm(dataDir, { recursive: true, force: true });
  }
});
