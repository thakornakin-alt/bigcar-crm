import { NextResponse } from "next/server";
import { validatePasswordResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const valid = await validatePasswordResetToken(String(body.token || "")).catch(() => false);
  return NextResponse.json({ valid });
}
