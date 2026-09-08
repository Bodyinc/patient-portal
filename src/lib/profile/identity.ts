import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

export type PatientDisplayIdentity = {
  /** Always displayable; falls back to "Patient" when the profile has no name. */
  fullName: string;
  /** Profile name for Stripe / legal records, or null if unset. */
  stripeName: string | null;
  avatarUrl: string | null;
};

/** Source of truth for the name/avatar shown in the portal. Never use auth user_metadata. */
export const getPatientDisplayIdentity = cache(
  async (userId: string): Promise<PatientDisplayIdentity> => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const stripeName = data?.full_name?.trim() || null;
    return {
      fullName: stripeName || "Patient",
      stripeName,
      avatarUrl: data?.avatar_url?.trim() || null,
    };
  },
);

/**
 * Keep auth metadata, claimed intake sessions, and Stripe in sync after a profile
 * name change so admin, Life File (reads profiles), and billing all see the new name.
 */
export async function propagatePatientNameChange(params: {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  stripeCustomerId?: string | null;
}): Promise<void> {
  const { userId, fullName, avatarUrl, stripeCustomerId } = params;

  const tasks: Promise<void>[] = [
    (async () => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      const metadata = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...metadata,
          full_name: fullName,
          ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
        },
      });
      if (error) throw error;
    })(),
    (async () => {
      const { error } = await supabaseAdmin
        .from("intake_sessions")
        .update({ full_name: fullName })
        .eq("claimed_by_user_id", userId);
      if (error) throw error;
    })(),
    (async () => {
      let customerId = stripeCustomerId ?? null;
      if (!customerId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", userId)
          .maybeSingle();
        customerId = profile?.stripe_customer_id ?? null;
      }
      if (!customerId) return;
      await stripe.customers.update(customerId, { name: fullName });
    })(),
  ];

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[profile] name propagate failed:", result.reason);
    }
  }
}
