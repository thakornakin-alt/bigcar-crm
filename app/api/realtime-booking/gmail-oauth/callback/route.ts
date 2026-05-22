import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getRedirectUri(request: Request) {
  return process.env.GMAIL_OAUTH_REDIRECT_URI || `${new URL(request.url).origin}/api/realtime-booking/gmail-oauth/callback`;
}

function html(content: string, status = 200) {
  return new NextResponse(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return html(`<h1>Gmail OAuth Error</h1><pre>${escapeHtml(error)}</pre>`, 400);
  }

  if (!code) {
    return html("<h1>Missing OAuth code</h1>", 400);
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return html("<h1>Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET</h1>", 500);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(request),
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  const text = await response.text();
  if (!response.ok) {
    return html(`<h1>Token Exchange Failed</h1><pre>${escapeHtml(text)}</pre>`, 500);
  }

  const token = JSON.parse(text) as { refresh_token?: string; access_token?: string; scope?: string };
  const refreshToken = token.refresh_token || "";

  return html(`<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Gmail Refresh Token</title>
    <style>
      body{margin:0;background:#070a0f;color:#eef6ff;font-family:Arial,sans-serif;padding:24px}
      main{max-width:760px;margin:0 auto;border:1px solid #243041;border-radius:14px;background:#10151f;padding:20px}
      h1{font-size:24px;margin:0 0 12px}
      p{color:#aab6c8;line-height:1.6}
      textarea{width:100%;min-height:120px;border-radius:10px;border:1px solid #2d3a4c;background:#060910;color:#b8fff1;padding:12px;font-size:14px}
      code{color:#65ffd9}
      .warn{border:1px solid #f8c35c55;background:#2a1c0833;border-radius:10px;padding:12px;color:#ffe3aa}
    </style>
  </head>
  <body>
    <main>
      <h1>Gmail OAuth สำเร็จ</h1>
      ${
        refreshToken
          ? `<p>นำค่านี้ไปใส่ใน Vercel Environment Variable ชื่อ <code>GMAIL_REFRESH_TOKEN</code></p><textarea readonly>${escapeHtml(refreshToken)}</textarea>`
          : `<div class="warn">Google ไม่ส่ง refresh_token กลับมา อาจเคย authorize ไปแล้ว ให้เปิดลิงก์ start ใหม่โดยมี prompt=consent หรือ revoke access แล้วลองใหม่</div>`
      }
      <p class="warn">อย่าส่ง token นี้ในแชตหรือให้คนอื่นเห็น เพราะใช้สิทธิ์อ่าน Gmail ได้</p>
    </main>
  </body>
</html>`);
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
