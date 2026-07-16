import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPlatformSettings,
  effectiveShippingCents,
  effectiveConsultationCents,
} from "@/lib/settings/platform-settings";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export type ShopOrderFees = {
  shippingCents: number;
  consultationCents: number;
  medicationChanged: boolean;
};

// Consultation applies only when the patient does not already have an active subscription
// for this medicine (a genuine medication change) and is charged one time on the first
// invoice. Shipping applies to every shop order. Both use the live admin-configured amounts.
export async function computeShopOrderFees(
  userId: string,
  medicineId: string,
): Promise<ShopOrderFees> {
  const settings = await getPlatformSettings();
  const shippingCents = effectiveShippingCents(settings);

  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("medicine_id", medicineId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .limit(1)
    .maybeSingle();

  const medicationChanged = !existingSub;
  const consultationCents = medicationChanged ? effectiveConsultationCents(settings) : 0;
  return { shippingCents, consultationCents, medicationChanged };
}
