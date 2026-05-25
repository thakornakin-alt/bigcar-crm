import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

function dataDirectory() {
  return process.env.BIG_CAR_DATA_DIR
    ? path.resolve(process.env.BIG_CAR_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function storePath(fileName: string) {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "-");
  return path.join(dataDirectory(), safeName);
}

export async function readJsonStore<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(storePath(fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonStore<T>(fileName: string, data: T) {
  await mkdir(dataDirectory(), { recursive: true });
  await writeFile(storePath(fileName), JSON.stringify(data, null, 2), "utf8");
}

export function jsonStoreInfo() {
  return {
    provider: "json-file",
    dataDir: dataDirectory(),
    envKey: "BIG_CAR_DATA_DIR"
  };
}
