import { AppsScriptError, type AppsScriptErrorCode } from "../apps-script.ts";

export type StockReadErrorCode = AppsScriptErrorCode;

export type StockReadAttemptMeta = {
  attempts: number;
  attemptDurationsMs: number[];
  appsScriptDurationMs: number;
};

export class StockReadFailure extends Error {
  readonly code: StockReadErrorCode;
  readonly retryable: boolean;
  readonly meta: StockReadAttemptMeta;

  constructor(code: StockReadErrorCode, retryable: boolean, meta: StockReadAttemptMeta, message: string) {
    super(message);
    this.name = "StockReadFailure";
    this.code = code;
    this.retryable = retryable;
    this.meta = meta;
  }
}

export function classifyStockReadError(error: unknown): StockReadErrorCode {
  if (error instanceof AppsScriptError) return error.code;
  const message = error instanceof Error ? error.message : String(error || "");
  if (/missing environment variable|not configured/i.test(message)) return "configuration_error";
  if (/unknown action|action.*(?:missing|not found|unsupported)|ไม่รู้จัก.*action/i.test(message)) return "apps_script_action_missing";
  if (/invalid json|invalid response|unexpected token/i.test(message)) return "invalid_response";
  if (/timeout|timed out|abort/i.test(message)) return "timeout";
  if (/fetch failed|network|econn|enotfound|ไม่สามารถเชื่อมต่อ/i.test(message)) return "network_error";
  if (/http|upstream/i.test(message)) return "upstream_http_error";
  return "unknown_error";
}

export function isRetryableStockReadError(code: StockReadErrorCode) {
  return code === "timeout" || code === "network_error" || code === "upstream_http_error";
}

export function stockReadUserMessage(code: StockReadErrorCode) {
  switch (code) {
    case "timeout": return "ระบบสต๊อกตอบกลับช้ากว่าปกติ กรุณาลองใหม่";
    case "network_error": return "เชื่อมต่อข้อมูลสต๊อกไม่สำเร็จ กรุณาลองใหม่";
    case "apps_script_action_missing": return "ระบบอ่านสต๊อกยังไม่รองรับเวอร์ชันนี้ กรุณาแจ้งผู้ดูแลระบบ";
    case "configuration_error": return "ระบบอ่านสต๊อกยังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ";
    case "invalid_response": return "ข้อมูลตอบกลับจากระบบสต๊อกไม่ถูกต้อง กรุณาแจ้งผู้ดูแลระบบ";
    case "upstream_http_error": return "ระบบสต๊อกขัดข้องชั่วคราว กรุณาลองใหม่";
    default: return "โหลดข้อมูลสต๊อกไม่สำเร็จ กรุณาลองใหม่";
  }
}

// listStockVehicles already has the shared Apps Script bounded retry policy.
// Do not wrap it in a second retry loop here: nested 2x2 retries can turn a
// 15-second upstream timeout into roughly a 60-second user wait.
export async function readStockWithBoundedRetry<T>(
  read: () => Promise<T>,
  options: { now?: () => number } = {}
): Promise<{ value: T; meta: StockReadAttemptMeta }> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  try {
    const value = await read();
    const duration = Math.max(0, now() - startedAt);
    return { value, meta: { attempts: 1, attemptDurationsMs: [duration], appsScriptDurationMs: duration } };
  } catch (error) {
    const duration = Math.max(0, now() - startedAt);
    const code = classifyStockReadError(error);
    const retryable = isRetryableStockReadError(code);
    throw new StockReadFailure(code, retryable, {
      attempts: 1,
      attemptDurationsMs: [duration],
      appsScriptDurationMs: duration
    }, stockReadUserMessage(code));
  }
}
