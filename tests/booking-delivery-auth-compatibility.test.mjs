import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const authSecret = "booking-delivery-auth-compatibility-test-secret";

function sessionToken() {
  const now = Date.now();
  const user = {
    id: "USER-TEST",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    nickname: "Tester",
    phone: "",
    lineId: "",
    lineQrUrl: "",
    avatarUrl: "",
    position: "Sales",
    branch: "",
    role: "sales",
    locked: false,
    createdAt: "",
    updatedAt: ""
  };
  const payload = Buffer.from(JSON.stringify({ user, iat: now, exp: now + 60_000 })).toString("base64url");
  const signature = createHmac("sha256", authSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function startServer(authEnforcement, dataDir) {
  const port = await availablePort();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_SECRET: authSecret,
      BIG_CAR_DATA_DIR: dataDir,
      BIG_CAR_STORE_PROVIDER: "json",
      DATA_PROVIDER: "json",
      RDD_AUTH_ENFORCEMENT_ENABLED: String(authEnforcement)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next server exited before readiness:\n${output}`);
    try {
      await fetch(`${baseUrl}/robots.txt`);
      return { baseUrl, child };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  child.kill();
  throw new Error(`Next server did not become ready:\n${output}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    child.once("exit", resolve);
    setTimeout(resolve, 5_000);
  });
}

test("Booking Delivery GET remains rollback-safe while write auth stays enforced", { timeout: 120_000 }, async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "booking-delivery-auth-test-"));
  await writeFile(path.join(dataDir, "booking-delivery.json"), JSON.stringify({
    records: [
      { id: "OWNED", bookingId: "BK-OWNED", ownerUserId: "USER-TEST", status: "ยอดจอง" },
      { id: "UNASSIGNED", bookingId: "BK-UNASSIGNED", status: "ยอดจอง" }
    ]
  }), "utf8");

  try {
    const disabled = await startServer(false, dataDir);
    try {
      await t.test("flag=false + anonymous GET + scope=all succeeds", async () => {
        const response = await fetch(`${disabled.baseUrl}/api/booking-delivery?scope=all`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.records.length, 2);
      });

      await t.test("flag=false + anonymous GET + scope=mine returns zero matches", async () => {
        const response = await fetch(`${disabled.baseUrl}/api/booking-delivery?scope=mine`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.deepEqual(body.records, []);
      });

      await t.test("PATCH without auth remains 401", async () => {
        const response = await fetch(`${disabled.baseUrl}/api/booking-delivery`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "OWNED", workflowStatus: "รอส่งมอบ" })
        });
        assert.equal(response.status, 401);
      });
    } finally {
      await stopServer(disabled.child);
    }

    const enabled = await startServer(true, dataDir);
    try {
      await t.test("flag=true + anonymous GET returns 401", async () => {
        const response = await fetch(`${enabled.baseUrl}/api/booking-delivery`);
        assert.equal(response.status, 401);
      });

      await t.test("flag=true + authenticated GET succeeds", async () => {
        const response = await fetch(`${enabled.baseUrl}/api/booking-delivery`, {
          headers: { Cookie: `bigcar_sales_profile=${sessionToken()}` }
        });
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.records.length, 2);
      });
    } finally {
      await stopServer(enabled.child);
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
