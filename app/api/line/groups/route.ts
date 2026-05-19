import { NextResponse } from "next/server";
import { listLineGroups } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await listLineGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load LINE groups" },
      { status: 500 }
    );
  }
}
