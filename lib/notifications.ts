import { listCalendarEvents } from "@/lib/calendar-events";
import { listStockLeadMatches } from "@/lib/stock-matching";
import { listVehiclePrepRecords } from "@/lib/vehicle-prep";

export type CrmNotification = {
  id: string;
  category: "today" | "finance" | "prep" | "stock_match";
  title: string;
  plate: string;
  customerName: string;
  owner: string;
  detail: string;
  href: string;
  priority: "normal" | "important";
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function listCrmNotifications() {
  const today = todayKey();
  const [calendarEvents, prepRecords, stockMatches] = await Promise.all([
    listCalendarEvents({ from: today, to: today }).catch(() => []),
    listVehiclePrepRecords().catch(() => []),
    listStockLeadMatches().catch(() => [])
  ]);

  const notifications: CrmNotification[] = [];

  for (const event of calendarEvents) {
    notifications.push({
      id: `calendar-${event.id}`,
      category: "today",
      title: event.type === "garage_return" ? "รถกลับวันนี้" : event.type === "delivery" ? "นัดส่งมอบวันนี้" : event.title,
      plate: event.plate || "-",
      customerName: event.customerName || "-",
      owner: "ปฏิทิน",
      detail: event.detail || "กดเพื่อเปิดปฏิทิน",
      href: "/calendar",
      priority: "important"
    });
  }

  for (const record of prepRecords) {
    const missing: string[] = [];
    if (!record.garageReturnDate) missing.push("รอวันรถกลับ");
    if (!record.deliveryDate) missing.push("ยังไม่ได้นัดส่งมอบ");
    if (!record.checklist.decal) missing.push("ขาดลอกลาย");
    if (!record.checklist.wash) missing.push("ขาดล้างรถ");
    if (!missing.length) continue;

    notifications.push({
      id: `prep-${record.bookingId}`,
      category: "prep",
      title: "งานรอส่งมอบยังไม่ครบ",
      plate: record.plate || "-",
      customerName: record.customerName || "-",
      owner: "รอส่งมอบ",
      detail: missing.slice(0, 3).join(" / "),
      href: "/vehicle-prep",
      priority: "normal"
    });
  }

  for (const match of stockMatches.slice(0, 10)) {
    notifications.push({
      id: `match-${match.id}`,
      category: "stock_match",
      title: "พบรถตรงกับลูกค้ามุ่งหวัง",
      plate: match.vehicle.plate || "-",
      customerName: match.lead.name,
      owner: match.lead.ownerName || "ระบบแนะนำ",
      detail: match.reasons.join(" / "),
      href: "/stock-matches",
      priority: match.score >= 80 ? "important" : "normal"
    });
  }

  return notifications.slice(0, 60);
}
