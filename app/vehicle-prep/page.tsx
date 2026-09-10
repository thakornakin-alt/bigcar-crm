import { redirect } from "next/navigation";

export default function LegacyVehiclePrepPage() {
  redirect(`/booking-delivery-workspace?status=${encodeURIComponent("รอส่งมอบทั้งหมด")}`);
}
