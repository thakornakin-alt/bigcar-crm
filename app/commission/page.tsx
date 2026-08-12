import { notFound } from "next/navigation";
import { CommissionPreviewClient } from "@/components/commission/commission-preview-client";
import { getRddFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default function CommissionPage() {
  if (!getRddFeatureFlags().commissionPreview) notFound();
  return <CommissionPreviewClient />;
}
