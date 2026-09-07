import type { SalesUser } from "./types.ts";
import { isSameRegistrationEmail, parseSelfRegistration } from "./self-register.ts";

export type SelfRegisterDependencies = {
  listUsers: () => Promise<SalesUser[]>;
  registerUser: (input: ReturnType<typeof parseSelfRegistration>) => Promise<SalesUser>;
  createCredential: (userId: string, password: string) => Promise<unknown>;
  saveProfile: (user: SalesUser, options: { throwOnError?: boolean }) => Promise<SalesUser>;
};

export class SelfRegisterError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SelfRegisterError";
    this.status = status;
  }
}

export async function registerSelfSalesUser(body: Record<string, unknown>, dependencies: SelfRegisterDependencies): Promise<SalesUser> {
  const input = parseSelfRegistration(body);
  const existingUsers = await dependencies.listUsers();
  if (existingUsers.some((user) => isSameRegistrationEmail(user.email, input.email))) {
    throw new SelfRegisterError("อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ", 409);
  }
  if (existingUsers.length === 0) {
    throw new SelfRegisterError("ระบบยังไม่พร้อมสำหรับการสมัครสมาชิก กรุณาติดต่อผู้ดูแลระบบ", 503);
  }

  const user = await dependencies.registerUser(input);
  if (user.role !== "sales" || user.locked) {
    throw new SelfRegisterError("ไม่สามารถสร้างบัญชี Sales ได้ กรุณาติดต่อผู้ดูแลระบบ", 500);
  }
  await dependencies.createCredential(user.id, input.password);
  await dependencies.saveProfile(user, { throwOnError: true });
  return user;
}
