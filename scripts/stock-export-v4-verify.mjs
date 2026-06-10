import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = Number(process.env.STOCK_EXPORT_VERIFY_PORT || 3013);
const BASE_URL = process.env.STOCK_EXPORT_BASE_URL || `http://127.0.0.1:${PORT}`;
const NEXT_BIN = "node_modules/next/dist/bin/next";

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    ...options
  });
}

async function waitForServer(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok || response.status === 401 || response.status === 403) {
        return true;
      }
      lastError = `status=${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }
  throw new Error(`ไม่สามารถรอ Next server ให้พร้อมได้ภายในเวลา (${lastError})`);
}

async function run() {
  const server = spawnProcess(process.execPath, [NEXT_BIN, "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      STOCK_EXPORT_BASE_URL: BASE_URL
    }
  });

  let serverStdout = "";
  let serverStderr = "";

  server.stdout.on("data", (chunk) => {
    serverStdout += chunk.toString();
    process.stdout.write(chunk);
  });

  server.stderr.on("data", (chunk) => {
    serverStderr += chunk.toString();
    process.stderr.write(chunk);
  });

  const exitPromise = new Promise((resolve, reject) => {
    server.on("exit", (code, signal) => {
      if (code === 0) resolve({ code, signal });
      else reject(new Error(`Next server ออกจาก process ก่อนเวลา code=${code} signal=${signal}\n${serverStdout}\n${serverStderr}`));
    });
  });

  try {
    await waitForServer(`${BASE_URL}/stock-export?renderer=v4`);
    const test = spawnProcess(process.execPath, ["scripts/stock-export-v4-playwright.mjs"], {
      env: {
        ...process.env,
        STOCK_EXPORT_BASE_URL: BASE_URL
      }
    });

    await new Promise((resolve, reject) => {
      test.on("error", reject);
      test.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`V4 compare failed with code ${code}`));
      });
    });

    console.log("[stock-export-v4-verify] PASS");
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
    await Promise.race([
      exitPromise.catch(() => null),
      delay(5000)
    ]);
    if (!server.killed) {
      server.kill("SIGKILL");
    }
  }
}

run().catch((error) => {
  console.error("[stock-export-v4-verify] FAIL", error);
  process.exitCode = 1;
});
