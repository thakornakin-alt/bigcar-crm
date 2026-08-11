import type { SalesUser } from "@/lib/types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\-\s]{8,20}$/;

export function normalizeProfileEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeProfilePhone(value: unknown) {
  return String(value ?? "").trim().replace(/[\s-]+/g, "");
}

export function validateProfileIdentity(input: {
  firstName: unknown;
  lastName: unknown;
  nickname: unknown;
  phone: unknown;
  email?: unknown;
}) {
  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const nickname = String(input.nickname ?? "").trim();
  const phone = normalizeProfilePhone(input.phone);
  const email = input.email === undefined ? undefined : normalizeProfileEmail(input.email);

  if (!firstName || firstName.length > 80) throw new Error("กรุณากรอกชื่อให้ถูกต้อง");
  if (!lastName || lastName.length > 80) throw new Error("กรุณากรอกนามสกุลให้ถูกต้อง");
  if (!nickname || nickname.length > 40) throw new Error("กรุณากรอกชื่อเล่นให้ถูกต้อง");
  if (!phonePattern.test(String(input.phone ?? "").trim()) || phone.length < 9 || phone.length > 15) {
    throw new Error("กรุณากรอกเบอร์โทรให้ถูกต้อง");
  }
  if (email !== undefined && !emailPattern.test(email)) throw new Error("Email ไม่ถูกต้อง");

  return { firstName, lastName, nickname, phone, ...(email === undefined ? {} : { email }) };
}

export function profileDisplayName(user: Pick<SalesUser, "nickname" | "firstName" | "email">) {
  return user.nickname?.trim() || user.firstName?.trim() || user.email?.trim() || "ผู้ใช้งาน";
}

export function profileActivityName(user: Pick<SalesUser, "firstName" | "lastName" | "nickname" | "email">) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (name && user.nickname) return `${name} (${user.nickname})`;
  return name || profileDisplayName(user);
}

export function calculatorProfileContract(user: SalesUser | null | undefined) {
  return {
    nickname: user?.nickname || "",
    fullName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() : "",
    phone: normalizeProfilePhone(user?.phone),
    avatarUrl: user?.avatarUrl || "",
    lineId: user?.lineId || "",
    lineQrUrl: user?.lineQrUrl || "",
    branch: user?.branch || ""
  };
}
