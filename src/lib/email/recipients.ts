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

type EmailRecipient = {
  email: string;
  fullName: string | null;
};

export async function patientEmailByUserId(userId: string | null | undefined): Promise<{
  email: string;
  fullName: string | null;
} | null> {
  if (!userId) return null;
  const byId = await patientEmailsByUserIds([userId]);
  return byId.get(userId) ?? null;
}

export async function patientEmailsByUserIds(
  userIds: string[],
): Promise<Map<string, EmailRecipient>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, EmailRecipient>();
  if (ids.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ids);

  for (const row of data ?? []) {
    const email = row.email?.trim();
    if (!email) continue;
    map.set(row.id, { email, fullName: row.full_name ?? null });
  }
  return map;
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
  const byId = await patientEmailsByIntakeSessionIds([sessionId]);
  return byId.get(sessionId) ?? null;
}

export async function patientEmailsByIntakeSessionIds(
  sessionIds: string[],
): Promise<Map<string, EmailRecipient>> {
  const ids = [...new Set(sessionIds.filter(Boolean))];
  const map = new Map<string, EmailRecipient>();
  if (ids.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("intake_sessions")
    .select("id, email, full_name")
    .in("id", ids);

  for (const row of data ?? []) {
    const email = row.email?.trim();
    if (!email) continue;
    map.set(row.id, { email, fullName: row.full_name ?? null });
  }
  return map;
}

export async function providerEmailByUserId(providerId: string | null | undefined): Promise<{
  email: string;
  fullName: string | null;
} | null> {
  return patientEmailByUserId(providerId);
}
