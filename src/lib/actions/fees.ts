"use server";

import {
  getPlatformSettings,
  effectiveShippingCents,
  effectiveConsultationCents,
} from "@/lib/settings/platform-settings";
import { computeShopOrderFees } from "@/lib/shop/order-fees";
import { createClient } from "@/lib/supabase/server";

export type PublicFees = {
  shippingFeeCents: number;
  consultationFeeCents: number;
};

export async function getPublicFees(): Promise<PublicFees> {
  const settings = await getPlatformSettings();
  return {
    shippingFeeCents: effectiveShippingCents(settings),
    consultationFeeCents: effectiveConsultationCents(settings),
  };
}

export type ShopOrderFeesResult = {
  shippingCents: number;
  consultationCents: number;
};

export async function getShopOrderFees(medicineId: string): Promise<ShopOrderFeesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { shippingCents: 0, consultationCents: 0 };

  const { shippingCents, consultationCents } = await computeShopOrderFees(user.id, medicineId);
  return { shippingCents, consultationCents };
}
