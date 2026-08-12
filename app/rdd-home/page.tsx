import { notFound } from "next/navigation";
import { RddHomeClient } from "@/components/rdd/rdd-home-client";
import { currentBangkokMonth } from "@/lib/booking-delivery-v2";
import { getRddFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default function RddHomePage() {
  if (!getRddFeatureFlags().workspaceReadOnly) notFound();
  const month = currentBangkokMonth();
  return <RddHomeClient initialYear={month.year} initialMonth={month.month} commissionPreview={getRddFeatureFlags().commissionPreview} />;
}
