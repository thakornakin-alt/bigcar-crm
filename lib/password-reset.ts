import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";
import { listSalesUsers, sendPasswordResetEmail } from "@/lib/apps-script";
import { resetAuthCredentialV2 } from "@/lib/auth-credentials-v2";

const STORE_FILE = "password-reset-tokens.json";
const TOKEN_TTL_MS = 15 * 60 * 1000;
const ACCOUNT_COOLDOWN_MS = 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const ACCOUNT_MAX_PER_HOUR = 5;
const SOURCE_MAX_PER_HOUR = 20;

type ResetTokenStatus = "active" | "processing" | "used" | "invalidated";

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  requestId: string;
  version: 1;
  status: ResetTokenStatus;
};

type RateEvent = { accountKey: string; sourceKey: string; requestedAt: string };
type PasswordResetStore = {
  version: 1;
  tokens: Record<string, PasswordResetTokenRecord>;
  rateEvents: RateEvent[];
};

const blankStore = (): PasswordResetStore => ({ version: 1, tokens: {}, rateEvents: [] });
const genericMessage = "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว";

export function normalizeResetEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(String(token), "utf8").digest("base64url");
}

function privacyKey(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured");
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

export function trustedPreviewOrigin() {
  if (process.env.VERCEL_ENV !== "preview") throw new Error("Password reset email is Preview-only");
  const host = String(process.env.VERCEL_URL || "").trim().toLowerCase();
  if (!/^(?:bigcar|bigcar-crm)-[a-z0-9-]+-thakornakin-8081s-projects\.vercel\.app$/.test(host)) {
    throw new Error("Invalid Preview reset origin");
  }
  return `https://${host}`;
}

function safeSource(request: Request) {
  const forwarded = String(request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return forwarded || String(request.headers.get("x-real-ip") || "unknown").trim() || "unknown";
}

function cleanedStore(store: PasswordResetStore, nowMs: number) {
  const rateEvents = store.rateEvents.filter((event) => Date.parse(event.requestedAt) > nowMs - RATE_WINDOW_MS);
  const tokens = Object.fromEntries(Object.entries(store.tokens).filter(([, token]) => Date.parse(token.expiresAt) > nowMs - RATE_WINDOW_MS));
  return { version: 1 as const, tokens, rateEvents };
}

async function casUpdate(mutator: (store: PasswordResetStore) => PasswordResetStore | null) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot<PasswordResetStore>(STORE_FILE, blankStore());
    const next = mutator(snapshot.data);
    if (!next) return false;
    const result = await compareAndSwapJsonStore(STORE_FILE, next, snapshot.revision);
    if (result.updated) return true;
  }
  throw new Error("Password reset store conflict");
}

export async function requestPasswordReset(request: Request, emailInput: unknown) {
  const email = normalizeResetEmail(emailInput);
  const now = Date.now();
  const accountKey = privacyKey(`account:${email}`);
  const sourceKey = privacyKey(`source:${safeSource(request)}`);
  let allowed = false;

  await casUpdate((raw) => {
    const store = cleanedStore(raw, now);
    const accountEvents = store.rateEvents.filter((event) => event.accountKey === accountKey);
    const sourceEvents = store.rateEvents.filter((event) => event.sourceKey === sourceKey);
    const last = accountEvents.reduce((latest, event) => Math.max(latest, Date.parse(event.requestedAt)), 0);
    allowed = now - last >= ACCOUNT_COOLDOWN_MS && accountEvents.length < ACCOUNT_MAX_PER_HOUR && sourceEvents.length < SOURCE_MAX_PER_HOUR;
    return allowed
      ? { ...store, rateEvents: [...store.rateEvents, { accountKey, sourceKey, requestedAt: new Date(now).toISOString() }] }
      : store;
  });

  if (!allowed) {
    console.info("password_reset_rate_limited", { accountKey: accountKey.slice(0, 12), sourceKey: sourceKey.slice(0, 12) });
    return { message: genericMessage };
  }

  console.info("password_reset_requested", { accountKey: accountKey.slice(0, 12), sourceKey: sourceKey.slice(0, 12) });
  const account = (await listSalesUsers()).find((candidate) => normalizeResetEmail(candidate.email) === email && !candidate.locked);
  if (!account) {
    return { message: genericMessage };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const requestId = `pwdreset_${randomUUID().replace(/-/g, "")}`;
  const record: PasswordResetTokenRecord = {
    id: randomUUID(), userId: account.id, tokenHash,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
    usedAt: null, requestId, version: 1, status: "active"
  };
  await casUpdate((raw) => {
    const store = cleanedStore(raw, now);
    const tokens = Object.fromEntries(Object.entries(store.tokens).map(([key, token]) => [key,
      token.userId === account.id && token.status === "active" ? { ...token, status: "invalidated" as const } : token
    ]));
    return { ...store, tokens: { ...tokens, [tokenHash]: record } };
  });

  try {
    const result = await sendPasswordResetEmail({
      recipientEmail: account.email,
      displayName: [account.firstName, account.lastName].filter(Boolean).join(" "),
      resetUrl: `${trustedPreviewOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`,
      requestId
    });
    if (result.status !== "sent" && result.status !== "duplicate_request") throw new Error(result.status);
    console.info("password_reset_email_sent", { userId: account.id, requestId, status: result.status });
  } catch (error) {
    await casUpdate((raw) => {
      const token = raw.tokens[tokenHash];
      if (!token) return null;
      return { ...raw, tokens: { ...raw.tokens, [tokenHash]: { ...token, status: "invalidated" } } };
    });
    console.error("password_reset_email_failed", { userId: account.id, requestId, reason: error instanceof Error ? error.message : "unknown" });
  }
  return { message: genericMessage };
}

export async function validatePasswordResetToken(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{43,}$/.test(String(rawToken || ""))) return false;
  const hash = hashResetToken(rawToken);
  const snapshot = await readJsonStoreSnapshot<PasswordResetStore>(STORE_FILE, blankStore());
  const token = snapshot.data.tokens[hash];
  return Boolean(token && token.status === "active" && !token.usedAt && Date.parse(token.expiresAt) > Date.now());
}

export async function completePasswordReset(rawToken: string, newPassword: string) {
  if (String(newPassword).length < 10) throw new Error("รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร");
  const tokenHash = hashResetToken(rawToken);
  const claimedAt = new Date().toISOString();
  let claimed: PasswordResetTokenRecord | null = null;
  const claimedOk = await casUpdate((store) => {
    const token = store.tokens[tokenHash];
    if (!token || token.status !== "active" || token.usedAt || Date.parse(token.expiresAt) <= Date.now()) return null;
    claimed = { ...token, status: "processing" };
    return { ...store, tokens: { ...store.tokens, [tokenHash]: claimed } };
  });
  if (!claimedOk || !claimed) throw new Error("ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้งานแล้ว");
  const claimedToken = claimed as PasswordResetTokenRecord;

  let credentialWritten = false;
  try {
    const credential = await resetAuthCredentialV2(claimedToken.userId, newPassword);
    credentialWritten = true;
    const finalized = await casUpdate((store) => {
      const token = store.tokens[tokenHash];
      if (!token || token.status !== "processing") return null;
      const tokens = Object.fromEntries(Object.entries(store.tokens).map(([key, item]) => [key,
        item.userId === claimedToken.userId ? { ...item, status: key === tokenHash ? "used" as const : "invalidated" as const, usedAt: key === tokenHash ? claimedAt : item.usedAt } : item
      ]));
      return { ...store, tokens };
    });
    if (!finalized) throw new Error("Password reset finalization failed");
    console.info("password_reset_completed", { userId: claimedToken.userId, requestId: claimedToken.requestId });
    return { sessionVersion: credential.sessionVersion };
  } catch (error) {
    if (!credentialWritten) {
      await casUpdate((store) => {
        const token = store.tokens[tokenHash];
        if (!token || token.status !== "processing") return null;
        return { ...store, tokens: { ...store.tokens, [tokenHash]: { ...token, status: "active" } } };
      }).catch(() => undefined);
    }
    throw error;
  }
}

export const PASSWORD_RESET_GENERIC_MESSAGE = genericMessage;
export const PASSWORD_RESET_POLICY = { tokenTtlMs: TOKEN_TTL_MS, accountCooldownMs: ACCOUNT_COOLDOWN_MS, accountMaxPerHour: ACCOUNT_MAX_PER_HOUR, sourceMaxPerHour: SOURCE_MAX_PER_HOUR };
