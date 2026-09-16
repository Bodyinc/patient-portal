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

/** Ops inbox plus every user with the admin role (deduped). */
export async function adminRecipientEmails(): Promise<string[]> {
  const emails = new Set<string>();
  const inbox = adminNotifyEmail();
  if (inbox) emails.add(inbox.toLowerCase());

  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) {
    console.error("[email] admin roles lookup failed:", error);
  }

  const ids = [...new Set((roles ?? []).map((r) => r.user_id).filter(Boolean))];
  if (ids.length > 0) {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("id", ids);
    if (profileError) {
      console.error("[email] admin profiles lookup failed:", profileError);
    }
    for (const p of profiles ?? []) {
      const email = p.email?.trim();
      if (email) emails.add(email.toLowerCase());
    }
  }

  return [...emails];
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

/** Practitioners currently assigned to this patient's medication request(s). */
export async function assignedProvidersForPatient(params: {
  userId: string;
  medicineId?: string | null;
}): Promise<{ id: string; email: string; fullName: string | null }[]> {
  let query = supabaseAdmin
    .from("medication_requests")
    .select("provider_id")
    .eq("user_id", params.userId)
    .not("provider_id", "is", null);

  if (params.medicineId) query = query.eq("medicine_id", params.medicineId);

  const { data, error } = await query;
  if (error) {
    console.error("[email] assigned providers lookup failed:", error);
    return [];
  }

  let ids = [
    ...new Set(
      (data ?? []).map((row) => row.provider_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  if (ids.length === 0 && params.medicineId) {
    const fallback = await supabaseAdmin
      .from("medication_requests")
      .select("provider_id")
      .eq("user_id", params.userId)
      .not("provider_id", "is", null);
    if (fallback.error) {
      console.error("[email] assigned providers fallback failed:", fallback.error);
      return [];
    }
    ids = [
      ...new Set(
        (fallback.data ?? [])
          .map((row) => row.provider_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  if (ids.length === 0) return [];

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ids);
  if (profileError) {
    console.error("[email] assigned provider profiles failed:", profileError);
    return [];
  }

  const result: { id: string; email: string; fullName: string | null }[] = [];
  for (const row of profiles ?? []) {
    const email = row.email?.trim();
    if (!email) continue;
    result.push({ id: row.id, email, fullName: row.full_name ?? null });
  }
  return result;
}
