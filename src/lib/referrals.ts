import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { sendTransactionalEmail } from "@/lib/email/send";
import { referralRewardEmail } from "@/lib/email/referral-emails";
import { recordWalletTransaction } from "@/lib/wallet";

export const REFERRAL_COOKIE = "bodyinc-ref";
export const REFERRAL_REWARD_CENTS = 5000;

// No 0/O/1/I/L — codes get read aloud and retyped.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// Referrals only attach to freshly created accounts, so an existing customer
// can't click a friend's link and mint a reward from their own next renewal.
const ATTACH_WINDOW_HOURS = 48;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function generateCode(): string {
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `BODY-${suffix}`;
}

export function buildReferralLink(code: string): string {
  return `${appUrl()}/r/${encodeURIComponent(code)}`;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.referral_code) return profile.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId)
      .is("referral_code", null);
    if (updateErr) continue; // unique collision on the code — try another

    const { data: fresh } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();
    if (fresh?.referral_code) return fresh.referral_code;
  }
  throw new Error("Could not allocate a referral code.");
}

export type ReferralSummary = {
  code: string;
  link: string;
  invited: number;
  converted: number;
  earnedCents: number;
};

// Fail-soft so pages render even before the referrals migration is applied.
export async function getReferralSummary(userId: string): Promise<ReferralSummary | null> {
  try {
    const [code, { data: rows }] = await Promise.all([
      getOrCreateReferralCode(userId),
      supabaseAdmin.from("referrals").select("status, reward_cents").eq("referrer_user_id", userId),
    ]);
    const all = rows ?? [];
    const converted = all.filter((r) => r.status === "converted");
    return {
      code,
      link: buildReferralLink(code),
      invited: all.length,
      converted: converted.length,
      earnedCents: converted.reduce((sum, r) => sum + (r.reward_cents ?? 0), 0),
    };
  } catch (error) {
    console.warn("[referrals] summary unavailable:", error);
    return null;
  }
}

export async function resolveReferrerByCode(
  code: string,
): Promise<{ id: string; email: string | null; full_name: string | null } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .eq("referral_code", trimmed)
    .maybeSingle();
  return data ?? null;
}

export async function attachReferral(params: {
  code: string;
  referredUserId: string;
}): Promise<boolean> {
  const referrer = await resolveReferrerByCode(params.code);
  if (!referrer) return false;
  if (referrer.id === params.referredUserId) return false;

  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(params.referredUserId);
  const referred = userRes?.user;
  if (!referred) return false;

  const referredEmail = referred.email?.toLowerCase() ?? null;
  if (referredEmail && referrer.email && referredEmail === referrer.email.toLowerCase()) {
    return false;
  }
  const createdAt = referred.created_at ? new Date(referred.created_at).getTime() : 0;
  if (Date.now() - createdAt > ATTACH_WINDOW_HOURS * 60 * 60 * 1000) return false;

  const { error } = await supabaseAdmin.from("referrals").insert({
    referrer_user_id: referrer.id,
    referred_user_id: params.referredUserId,
    code: params.code.trim(),
    status: "pending",
    reward_cents: REFERRAL_REWARD_CENTS,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  return !error;
}

export async function attachReferralFromCookie(referredUserId: string): Promise<void> {
  const cookieStore = await cookies();
  const code = cookieStore.get(REFERRAL_COOKIE)?.value;
  if (!code) return;

  await attachReferral({ code, referredUserId });
  cookieStore.delete(REFERRAL_COOKIE);
  await maybeConvertReferral(referredUserId);
}

// Converts a pending referral once the referred user has a real successful payment,
// crediting the referrer's Stripe balance (auto-applies to their next invoice).
// Callable from any path, any number of times — the status flip claims the row.
export async function maybeConvertReferral(referredUserId: string): Promise<void> {
  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_user_id, code, reward_cents, status")
    .eq("referred_user_id", referredUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (!referral) return;

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("user_id", referredUserId)
    .eq("status", "succeeded")
    .gt("amount_cents", 0)
    .limit(1)
    .maybeSingle();
  if (!payment) return;

  const { data: claimed } = await supabaseAdmin
    .from("referrals")
    .update({ status: "converted", converted_at: new Date().toISOString() })
    .eq("id", referral.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const { data: referrerProfile } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", referral.referrer_user_id)
    .maybeSingle();

  try {
    const customerId = await getOrCreateStripeCustomer({
      userId: referral.referrer_user_id,
      email: referrerProfile?.email ?? null,
      name: referrerProfile?.full_name ?? null,
    });
    const txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -referral.reward_cents,
      currency: "usd",
      description: `Referral reward (${referral.code})`,
    });
    await supabaseAdmin
      .from("referrals")
      .update({ stripe_balance_txn_id: txn.id })
      .eq("id", referral.id);
    await recordWalletTransaction({
      userId: referral.referrer_user_id,
      amountCents: referral.reward_cents,
      type: "referral_reward",
      description: "Referral reward — friend started a plan",
      referralId: referral.id,
    });
  } catch (error) {
    // Give the reward back to a retryable state rather than silently losing it.
    await supabaseAdmin
      .from("referrals")
      .update({ status: "pending", converted_at: null })
      .eq("id", referral.id);
    console.error("[referrals] reward credit failed:", error);
    return;
  }

  if (referrerProfile?.email) {
    const { subject, html } = referralRewardEmail({
      fullName: referrerProfile.full_name,
      amountCents: referral.reward_cents,
    });
    void sendTransactionalEmail({ to: referrerProfile.email, subject, html });
  }
}
