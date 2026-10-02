import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { StockVehicle } from "@/lib/types";

const SNAPSHOT_FILE = "stock-snapshot.json";
const VERSION_FILE = "stock-snapshot-version.json";

export type StockSnapshot = {
  version: string;
  sourceName: string;
  updatedAt: string;
  vehicles: StockVehicle[];
  total: number;
};

type StockSnapshotVersion = {
  version: string;
  sourceName: string;
  updatedAt: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function versionFor(sourceName: string, updatedAt: string) {
  return [clean(sourceName) || "stock", clean(updatedAt) || "unknown"].join("@");
}

export async function getStockSnapshot() {
  return readJsonStore<StockSnapshot | null>(SNAPSHOT_FILE, null);
}

export async function getStockSnapshotVersion() {
  return readJsonStore<StockSnapshotVersion>(VERSION_FILE, {
    version: "missing",
    sourceName: "",
    updatedAt: ""
  });
}

export async function markStockSnapshotVersion(sourceName: string) {
  const updatedAt = new Date().toISOString();
  const version = versionFor(sourceName, updatedAt);
  const next = { version, sourceName: clean(sourceName), updatedAt };
  await writeJsonStore(VERSION_FILE, next);
  return next;
}

export async function saveStockSnapshot(input: {
  vehicles: StockVehicle[];
  total: number;
  version?: string;
  sourceName?: string;
}) {
  let marker = await getStockSnapshotVersion();
  if (!marker.version || marker.version === "missing") {
    marker = await markStockSnapshotVersion(input.sourceName || "legacy-stock");
  }
  const snapshot: StockSnapshot = {
    version: input.version || marker.version,
    sourceName: clean(input.sourceName) || marker.sourceName,
    updatedAt: new Date().toISOString(),
    vehicles: input.vehicles,
    total: input.total
  };
  await writeJsonStore(SNAPSHOT_FILE, snapshot);
  return snapshot;
}

export function stockSnapshotIsCurrent(snapshot: StockSnapshot | null, marker: StockSnapshotVersion) {
  return Boolean(
    snapshot &&
    snapshot.version &&
    marker.version &&
    marker.version !== "missing" &&
    snapshot.version === marker.version &&
    snapshot.total >= 0 &&
    snapshot.vehicles.length >= snapshot.total
  );
}
