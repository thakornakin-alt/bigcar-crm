import { NextResponse } from "next/server";
import { jsonStoreInfo, readJsonStore, writeJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

type StorageHealth = {
  lastCheckedAt: string;
};

export async function GET() {
  const checkedAt = new Date().toISOString();
  const info = jsonStoreInfo();

  try {
    const previous = await readJsonStore<StorageHealth>("__storage-health.json", { lastCheckedAt: "" });
    await writeJsonStore<StorageHealth>("__storage-health.json", { lastCheckedAt: checkedAt });

    return NextResponse.json({
      ok: true,
      info,
      previousCheckedAt: previous.lastCheckedAt,
      checkedAt
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      info,
      checkedAt,
      error: error instanceof Error ? error.message : "Storage check failed"
    });
  }
}
