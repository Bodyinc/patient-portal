import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type PlatformSettings = {
  consultation_fee_cents: number;
  consultation_fee_enabled: boolean;
  shipping_fee_cents: number;
  shipping_fee_enabled: boolean;
  referral_reward_cents: number;
  referral_enabled: boolean;
  maintenance_mode: boolean;
  new_signups_enabled: boolean;
};

const DEFAULTS: PlatformSettings = {
  consultation_fee_cents: 0,
  consultation_fee_enabled: false,
  shipping_fee_cents: 0,
  shipping_fee_enabled: false,
  referral_reward_cents: 5000,
  referral_enabled: true,
  maintenance_mode: false,
  new_signups_enabled: true,
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabaseAdmin.from("platform_settings").select("key, value");
  if (error) {
    console.error("[platform-settings] read failed:", error.message);
    return { ...DEFAULTS };
  }

  const result = { ...DEFAULTS };
  for (const row of data ?? []) {
    if (row.key in result) {
      (result as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return result;
}

export function effectiveShippingCents(s: PlatformSettings): number {
  return s.shipping_fee_enabled ? s.shipping_fee_cents : 0;
}

export function effectiveConsultationCents(s: PlatformSettings): number {
  return s.consultation_fee_enabled ? s.consultation_fee_cents : 0;
}
