import { notFound } from "next/navigation";
import { CommissionRealClient } from "@/components/commission/commission-real-client";
import { getRddFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default function CommissionPage() {
  if (!getRddFeatureFlags().commissionPreview) notFound();
  return <CommissionRealClient />;
}
