import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    console.warn("[email] NEXT_PUBLIC_APP_URL not set — email links will use localhost");
    return "http://localhost:3000";
  }
  return url.replace(/\/$/, "");
}

export function adminAppUrl(): string | null {
  const url = process.env.ADMIN_APP_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export function adminNotifyEmail(): string | null {
  const email = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  return email || null;
}

export async function patientEmailByUserId(userId: string | null | undefined): Promise<{
  email: string;
  fullName: string | null;
} | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  const email = data?.email?.trim();
  if (!email) return null;
  return { email, fullName: data?.full_name ?? null };
}

export async function patientEmailByStripeCustomer(
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.email) return customer.email;
  } catch {
    // Best-effort.
  }
  return null;
}

export async function patientEmailByIntakeSession(sessionId: string | null | undefined): Promise<{
  email: string;
  fullName: string | null;
} | null> {
  if (!sessionId) return null;
  const { data } = await supabaseAdmin
    .from("intake_sessions")
    .select("email, full_name")
    .eq("id", sessionId)
    .maybeSingle();
  const email = data?.email?.trim();
  if (!email) return null;
  return { email, fullName: data?.full_name ?? null };
}

export async function providerEmailByUserId(providerId: string | null | undefined): Promise<{
  email: string;
  fullName: string | null;
} | null> {
  return patientEmailByUserId(providerId);
}
