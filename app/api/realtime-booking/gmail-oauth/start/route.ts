import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getRedirectUri(request: Request) {
  return process.env.GMAIL_OAUTH_REDIRECT_URI || `${new URL(request.url).origin}/api/realtime-booking/gmail-oauth/callback`;
}

export async function GET(request: Request) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Missing GMAIL_CLIENT_ID" }, { status: 500 });
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");

  return NextResponse.redirect(authUrl);
}
