import { NextResponse } from "next/server";
import { PASSWORD_RESET_GENERIC_MESSAGE, requestPasswordReset } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await requestPasswordReset(request, body.email));
  } catch (error) {
    console.error("password_reset_request_failed", { reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
  }
}
