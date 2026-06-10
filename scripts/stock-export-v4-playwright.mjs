import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { chromium } from "playwright";

const BASE_URL = process.env.STOCK_EXPORT_BASE_URL || "http://127.0.0.1:3013";
const GENERATE_BASELINE = process.argv.includes("--write-baseline");
const FIXTURE_DIR = path.resolve("tests", "fixtures", "stock-export-v4");
const SCENARIO_FIXTURE_PATH = path.join(FIXTURE_DIR, "scenarios.json");

const commonAuthUser = {
  id: "sales-user-1",
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z",
  email: "sales@example.com",
  firstName: "Sales",
  lastName: "User",
  nickname: "BIG CAR",
  phone: "0912345678",
  lineId: "@bigcar",
  lineQrUrl: "",
  avatarUrl: "",
  position: "sales",
  branch: "HQ",
  role: "sales",
  locked: false
};

function buildVehicle(index, scenario) {
  const group = scenario.group || "VIP CAR";
  const prefixByGroup = {
    "VAN": "1นข",
    "VIP CAR": "3ฒญ",
    "SEDAN-M": "2ขก",
    "PICK-UP D-CAB": "1ฒฆ",
    "SEDAN-L": "4ขล"
  };
  const platePrefix = prefixByGroup[group] || "1ขก";
  const plateNumber = String((scenario.startPlateNumber || 1100) + index);
  const longModel = scenario.longName || group === "PICK-UP D-CAB";
  const modelPool = longModel
    ? [
        "TOYOTA COMMUTER 3.0 D4D หลังคาสูง MT",
        "TOYOTA HILUX REVO D-CAB Z Edition 2.4 MID AT 2WD",
        "MITSUBISHI TRITON 2.4 GLX PLUS CAB"
      ]
    : [
        "TOYOTA ALPHARD 2.5 HV AT",
        "TOYOTA COROLLA ALTIS 1.8 HV Premium",
        "HONDA CIVIC 1.5 EL Turbo",
        "TOYOTA HILUX REVO 2.4 E Plus"
      ];
  const colorPool = ["ขาว", "เทา", "ดำ", "บรอนซ์", "แดง"];
  const locationPool = ["อู่ปรับสภาพ/เทพารักษ์", "อู่ปรับสภาพ/บางนา", "อู่ปรับสภาพ/กาญจนา"];
  const gearPool = group === "VAN" ? ["AT"] : ["AT", "MT", "CVT"];

  return {
    plate: `${platePrefix} ${plateNumber}`,
    brand: "TOYOTA",
    model: modelPool[index % modelPool.length],
    year: String((scenario.startYear || 2019) + (index % 5)),
    color: colorPool[index % colorPool.length],
    salePrice: String((scenario.startPrice || 420000) + index * (scenario.priceStep || 10000)),
    source: "mock",
    ownership: "ชื่อบริษัท",
    project: "BIG CAR",
    campaign: "",
    parkingLocation: locationPool[index % locationPool.length],
    status: "รอขาย",
    gear: gearPool[index % gearPool.length],
    mileage: String((scenario.startMileage || 55000) + index * (scenario.mileageStep || 8800)),
    vehicleGroup: group,
    vin: `VIN${String(index + 1).padStart(4, "0")}`,
    engineNo: `ENG${String(index + 1).padStart(4, "0")}`,
    extraFields: {}
  };
}

function buildScenario(config) {
  return {
    name: config.name,
    vehicles: Array.from({ length: config.count }, (_, index) => buildVehicle(index, config)),
    reservations: Array.isArray(config.reserveIndices)
      ? config.reserveIndices.map((index) => {
          const platePrefix = {
            "VAN": "1นข",
            "VIP CAR": "3ฒญ",
            "SEDAN-M": "2ขก",
            "PICK-UP D-CAB": "1ฒฆ",
            "SEDAN-L": "4ขล"
          }[config.group] || "1ขก";
          const plateNumber = String((config.startPlateNumber || 1100) + index);
          return `${platePrefix} ${plateNumber}`;
        })
      : [],
    authUser: config.authUser !== false
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error("ไม่ใช่ PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length + 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`PNG color type ไม่รองรับ: bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  const previous = Buffer.alloc(rowBytes);
  let inputOffset = 0;
  let outputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw.readUInt8(inputOffset);
    inputOffset += 1;
    const row = raw.subarray(inputOffset, inputOffset + rowBytes);
    inputOffset += rowBytes;
    const recon = Buffer.alloc(rowBytes);

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= bytesPerPixel ? recon[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const value = row[x];
      if (filter === 0) recon[x] = value;
      else if (filter === 1) recon[x] = (value + left) & 255;
      else if (filter === 2) recon[x] = (value + up) & 255;
      else if (filter === 3) recon[x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) recon[x] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error(`PNG filter ไม่รองรับ: ${filter}`);
    }

    recon.copy(pixels, outputOffset);
    recon.copy(previous, 0, 0, rowBytes);
    outputOffset += rowBytes;
  }

  return { width, height, pixels };
}

function comparePngBuffers(actualBuffer, expectedBuffer) {
  const actual = decodePng(actualBuffer);
  const expected = decodePng(expectedBuffer);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`ขนาด PNG ไม่ตรงกัน actual=${actual.width}x${actual.height} expected=${expected.width}x${expected.height}`);
  }
  let different = 0;
  for (let index = 0; index < actual.pixels.length; index += 1) {
    if (actual.pixels[index] !== expected.pixels[index]) different += 1;
  }
  return {
    different,
    total: actual.pixels.length,
    ratio: different / actual.pixels.length
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadScenarios() {
  const raw = await fs.readFile(SCENARIO_FIXTURE_PATH, "utf8");
  return JSON.parse(raw);
}

async function runScenario(browser, scenarioConfig) {
  const scenario = buildScenario(scenarioConfig);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1600 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  const page = await context.newPage();

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: scenario.authUser ? commonAuthUser : null })
    });
  });

  await page.route("**/api/stock/list**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ vehicles: scenario.vehicles, total: scenario.vehicles.length })
    });
  });

  await page.route("**/api/line/groups**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        groups: [
          { groupId: "g1", type: "group", name: "ฝ่ายขาย", lastSeenAt: "2026-06-10T00:00:00.000Z" }
        ]
      })
    });
  });

  await page.route("**/api/reports/history**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports: [] }) });
  });

  await page.route("**/api/line/reservations**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ activePlates: scenario.reservations })
    });
  });

  await page.goto(`${BASE_URL}/stock-export?renderer=v4`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /เซฟ PNG/ }).waitFor({ state: "visible" });

  const downloads = [];
  page.on("download", (download) => downloads.push(download));
  await page.getByRole("button", { name: /เซฟ PNG/ }).first().click();

  const expectedDownloads = scenario.vehicles.length > 20 ? Math.ceil(scenario.vehicles.length / 20) : 1;
  const deadline = Date.now() + 25000;
  while (downloads.length < expectedDownloads && Date.now() < deadline) {
    await page.waitForTimeout(250);
  }

  if (downloads.length !== expectedDownloads) {
    throw new Error(`ดาวน์โหลดไม่ครบ scenario=${scenario.name} expected=${expectedDownloads} actual=${downloads.length}`);
  }

  const outputDir = path.join(os.tmpdir(), "stock-export-v4-playwright", scenario.name);
  await ensureDir(outputDir);
  const savedFiles = [];

  for (let index = 0; index < downloads.length; index += 1) {
    const download = downloads[index];
    const filename = download.suggestedFilename();
    const target = path.join(outputDir, filename);
    await download.saveAs(target);
    savedFiles.push(target);
  }

  await context.close();
  return savedFiles;
}

async function main() {
  const scenarios = await loadScenarios();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of scenarios) {
      const files = await runScenario(browser, scenario);
      console.log(`[stock-export-v4] scenario=${scenario.name} downloaded=${files.length}`);

      if (GENERATE_BASELINE) {
        await ensureDir(FIXTURE_DIR);
        for (let index = 0; index < files.length; index += 1) {
          const destination = path.join(FIXTURE_DIR, `${scenario.name}-page${index + 1}.png`);
          await fs.copyFile(files[index], destination);
          console.log(`[stock-export-v4] baseline written ${destination}`);
        }
        continue;
      }

      for (let index = 0; index < files.length; index += 1) {
        const expectedPath = path.join(FIXTURE_DIR, `${scenario.name}-page${index + 1}.png`);
        const actual = await fs.readFile(files[index]);
        const expected = await fs.readFile(expectedPath);
        const comparison = comparePngBuffers(actual, expected);
        console.log(
          `[stock-export-v4] compare scenario=${scenario.name} page=${index + 1} diff=${comparison.different}/${comparison.total} (${(comparison.ratio * 100).toFixed(4)}%)`
        );
        if (comparison.ratio > 0.0001) {
          throw new Error(`PNG แตกต่างเกิน threshold scenario=${scenario.name} page=${index + 1} ratio=${comparison.ratio}`);
        }
      }
    }

    console.log("[stock-export-v4] PASS");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[stock-export-v4] FAIL", error);
  process.exitCode = 1;
});
