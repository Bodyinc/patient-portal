import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPlatformSettings,
  effectiveShippingCents,
  effectiveConsultationCents,
} from "@/lib/settings/platform-settings";

export type ShopOrderFees = {
  shippingCents: number;
  consultationCents: number;
};

// Onboarding's first invoice waives consultation. After the patient has paid once,
// logged-in shop checkout charges (and shows) the live admin-configured consultation fee.
export async function computeShopOrderFees(
  userId: string,
  _medicineId: string,
): Promise<ShopOrderFees> {
  const settings = await getPlatformSettings();
  const shippingCents = effectiveShippingCents(settings);

  const [{ data: priorPayment }, { data: priorSub }] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "succeeded")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due", "canceled"])
      .limit(1)
      .maybeSingle(),
  ]);

  const hasPurchased = Boolean(priorPayment || priorSub);
  const consultationCents = hasPurchased ? effectiveConsultationCents(settings) : 0;
  return { shippingCents, consultationCents };
}
