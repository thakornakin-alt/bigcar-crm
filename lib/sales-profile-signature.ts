import type { SalesUser } from "@/lib/types";

export function salesProfileSignature(user: SalesUser | null | undefined) {
  if (!user) return "";

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.nickname;
  const lines = [
    "ข้อมูลเซลล์",
    `ชื่อ : ${name}`,
    user.nickname ? `ชื่อเล่น : ${user.nickname}` : "",
    user.phone ? `เบอร์โทร : ${user.phone}` : "",
    user.lineId ? `LINE ID : ${user.lineId}` : "",
    user.branch ? `สาขา : ${user.branch}` : "",
    user.position ? `ทีม/ตำแหน่ง : ${user.position}` : ""
  ].filter(Boolean);

  return lines.length > 1 ? lines.join("\n") : "";
}

export function appendSalesProfileSignature(reportText: string, user: SalesUser | null | undefined) {
  const signature = salesProfileSignature(user);
  if (!signature) return reportText;
  return [reportText.trim(), "", signature].join("\n");
}
