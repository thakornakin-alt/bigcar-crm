import { normalizeProfileEmail, validateProfileIdentity } from "./user-profile.ts";

export const SELF_REGISTER_FORBIDDEN_FIELDS = [
  "role",
  "active",
  "locked",
  "admin",
  "super_admin",
  "ownerUserId",
  "branch",
  "position",
  "permissions"
] as const;

export function parseSelfRegistration(body: Record<string, unknown>) {
  const forbidden = SELF_REGISTER_FORBIDDEN_FIELDS.find((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (forbidden) throw new Error("ไม่สามารถกำหนดสิทธิ์หรือสถานะบัญชีได้");

  const password = String(body.password || "");
  if (password.length < 8) throw new Error("Password ต้องมีอย่างน้อย 8 ตัวอักษร");
  const identity = validateProfileIdentity({
    firstName: body.firstName,
    lastName: body.lastName,
    nickname: body.nickname,
    phone: body.phone,
    email: body.email
  });

  return {
    ...identity,
    email: normalizeProfileEmail(identity.email),
    password,
    lineId: "",
    lineQrUrl: "",
    avatarUrl: "",
    position: "Sales" as const,
    branch: "ไม่ระบุ"
  };
}

export function isSameRegistrationEmail(left: unknown, right: unknown) {
  return normalizeProfileEmail(left) === normalizeProfileEmail(right);
}
