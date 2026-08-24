import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";

const storeFile = "auth-credentials-v2.json";

export const AUTH_CREDENTIAL_VERSION = 2;
export const SCRYPT_PARAMETERS = {
  N: 32768,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024
} as const;

export type AuthCredentialV2 = {
  userId: string;
  algorithm: "scrypt";
  version: 2;
  salt: string;
  verifier: string;
  parameters: typeof SCRYPT_PARAMETERS;
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
};

type AuthCredentialStore = { credentials: Record<string, AuthCredentialV2> };

function blankStore(): AuthCredentialStore {
  return { credentials: {} };
}

function cleanUserId(userId: string) {
  const value = String(userId || "").trim();
  if (!value) throw new Error("Credential userId is required");
  return value;
}

async function derive(password: string, salt: Buffer) {
  if (String(password).length < 8) throw new Error("Password must be at least 8 characters");
  return await new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(String(password), salt, SCRYPT_PARAMETERS.keyLength, {
      N: SCRYPT_PARAMETERS.N,
      r: SCRYPT_PARAMETERS.r,
      p: SCRYPT_PARAMETERS.p,
      maxmem: SCRYPT_PARAMETERS.maxmem
    }, (error, result) => error ? reject(error) : resolve(result));
  });
}

export async function buildAuthCredentialV2(userId: string, password: string, now = new Date().toISOString()) {
  const salt = randomBytes(32);
  const verifier = await derive(password, salt);
  return {
    userId: cleanUserId(userId),
    algorithm: "scrypt" as const,
    version: AUTH_CREDENTIAL_VERSION as 2,
    salt: salt.toString("base64url"),
    verifier: verifier.toString("base64url"),
    parameters: SCRYPT_PARAMETERS,
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now
  };
}

export async function verifyAuthCredentialV2(credential: AuthCredentialV2, password: string) {
  if (credential.algorithm !== "scrypt" || credential.version !== AUTH_CREDENTIAL_VERSION) return false;
  try {
    const actual = await derive(password, Buffer.from(credential.salt, "base64url"));
    const expected = Buffer.from(credential.verifier, "base64url");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function getAuthCredentialV2(userId: string) {
  const snapshot = await readJsonStoreSnapshot<AuthCredentialStore>(storeFile, blankStore());
  return snapshot.data.credentials[cleanUserId(userId)] || null;
}

export async function createAuthCredentialV2IfMissing(userId: string, password: string) {
  const safeUserId = cleanUserId(userId);
  const nextCredential = await buildAuthCredentialV2(safeUserId, password);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot<AuthCredentialStore>(storeFile, blankStore());
    const existing = snapshot.data.credentials[safeUserId];
    if (existing) return { credential: existing, created: false };
    const nextStore: AuthCredentialStore = {
      credentials: { ...snapshot.data.credentials, [safeUserId]: nextCredential }
    };
    const result = await compareAndSwapJsonStore(storeFile, nextStore, snapshot.revision);
    if (result.updated) return { credential: nextCredential, created: true };
  }
  throw new Error("Credential migration conflicted; retry login");
}

export async function resetAuthCredentialV2(userId: string, password: string) {
  const safeUserId = cleanUserId(userId);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot<AuthCredentialStore>(storeFile, blankStore());
    const existing = snapshot.data.credentials[safeUserId] || null;
    const now = new Date().toISOString();
    const replacement = await buildAuthCredentialV2(safeUserId, password, now);
    replacement.createdAt = existing?.createdAt || now;
    replacement.sessionVersion = (existing?.sessionVersion || 0) + 1;
    const nextStore: AuthCredentialStore = {
      credentials: { ...snapshot.data.credentials, [safeUserId]: replacement }
    };
    const result = await compareAndSwapJsonStore(storeFile, nextStore, snapshot.revision);
    if (result.updated) return replacement;
  }
  throw new Error("Credential reset conflicted; request a new reset link");
}

export function publicCredentialState(credential: AuthCredentialV2 | null) {
  return credential ? {
    algorithm: credential.algorithm,
    version: credential.version,
    sessionVersion: credential.sessionVersion,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt
  } : null;
}
