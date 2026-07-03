import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "./server";

export async function getOrCreateStripeCustomer(params: {
  userId: string;
  email: string | null;
  name?: string | null;
}): Promise<string> {
  const { userId, email, name } = params;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

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

export async function linkStripeCustomerToUser(params: {
  stripeCustomerId: string;
  userId: string;
}): Promise<void> {
  await stripe.customers.update(params.stripeCustomerId, {
    metadata: { user_id: params.userId },
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
