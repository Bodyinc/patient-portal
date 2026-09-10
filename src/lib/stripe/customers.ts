import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "./server";

const getProfileStripeCustomerId = cache(async (userId: string): Promise<string | null> => {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  return profile?.stripe_customer_id ?? null;
});

function isMissingStripeObject(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "resource_missing"
  );
}

export async function getOrCreateStripeCustomer(params: {
  userId: string;
  email: string | null;
  name?: string | null;
}): Promise<string> {
  const { userId, email, name } = params;

  const existingId = await getProfileStripeCustomerId(userId);
  if (existingId) {
    try {
      const existing = await stripe.customers.retrieve(existingId);
      if (!existing.deleted) return existingId;
    } catch (error) {
      // Customer IDs from a previous Stripe account 404 here; create a new one below.
      if (!isMissingStripeObject(error)) throw error;
    }
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: { user_id: userId },
  });

  await supabaseAdmin.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId);

  return customer.id;
}

export async function createGuestStripeCustomer(params: {
  email: string | null;
  name?: string | null;
  intakeSessionId: string;
}): Promise<string> {
  const customer = await stripe.customers.create({
    email: params.email ?? undefined,
    name: params.name ?? undefined,
    metadata: { intake_session_id: params.intakeSessionId },
  });
  return customer.id;
}

// A negative Stripe customer balance is credit (referral rewards / admin top-ups) that
// Stripe automatically deducts from the next invoice. Returned as positive cents.
export async function getCustomerCreditCents(userId: string): Promise<number> {
  try {
    const stripeCustomerId = await getProfileStripeCustomerId(userId);
    if (!stripeCustomerId) return 0;
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted) return 0;
    const balance = customer.balance ?? 0;
    return balance < 0 ? -balance : 0;
  } catch (error) {
    console.warn("[stripe] credit lookup failed:", error);
    return 0;
  }
}

export async function linkStripeCustomerToUser(params: {
  stripeCustomerId: string;
  userId: string;
}): Promise<void> {
  // Sync the customer to the ACCOUNT's email/name (authoritative) — the guest customer
  // was created with the intake email, which may differ if the user changed it at signup.
  const [{ data: userData }, { data: profile }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(params.userId),
    supabaseAdmin.from("profiles").select("full_name").eq("id", params.userId).maybeSingle(),
  ]);
  const email = userData?.user?.email ?? undefined;
  const name = profile?.full_name?.trim() || undefined;

  await stripe.customers.update(params.stripeCustomerId, {
    metadata: { user_id: params.userId },
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
  });
  await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: params.stripeCustomerId })
    .eq("id", params.userId);
}

export async function linkOnboardingStripeToUser(params: {
  sessionId: string;
  stripeCustomerId: string;
  userId: string;
}): Promise<void> {
  await linkStripeCustomerToUser({
    stripeCustomerId: params.stripeCustomerId,
    userId: params.userId,
  });
  await supabaseAdmin
    .from("subscriptions")
    .update({ user_id: params.userId })
    .eq("session_id", params.sessionId);
  await supabaseAdmin
    .from("payments")
    .update({ user_id: params.userId })
    .eq("session_id", params.sessionId);
}
