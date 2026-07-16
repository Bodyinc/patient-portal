import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { reconcileLatestSubscriptionForUser } from "@/lib/stripe/reconcile";
import { calculateCheckoutPricing } from "../../onboarding/_lib/intake-pricing";
import { getPlatformSettings, effectiveShippingCents } from "@/lib/settings/platform-settings";

export default async function OrderConfirmationPage() {
  const { user } = await requirePatientSession();

  // Self-heal: pull the latest state from Stripe so the order is confirmed even if the
  // webhook was delayed or not running.
  await reconcileLatestSubscriptionForUser(user.id);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "package_id, medicine_id, created_at, packages(name, price, duration_months), medicines(name)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pkg = (
    sub as { packages?: { name: string; price: number; duration_months: number } } | null
  )?.packages;
  const med = (sub as { medicines?: { name: string } } | null)?.medicines;

  // Show the real charged amount from the payment; fall back to a computed estimate.
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("amount_cents, raw_event")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const totalPaid = pay
    ? Number(pay.amount_cents) / 100
    : pkg
      ? calculateCheckoutPricing(Number(pkg.price)).total
      : null;

  // Itemize the charge from the invoice: positive lines = plan price, negative lines =
  // discounts (promo / one-time credits), balance delta = wallet credit Stripe consumed.
  const invoice = pay?.raw_event as {
    lines?: { data?: Array<{ amount?: number | null; description?: string | null }> };
    starting_balance?: number | null;
    ending_balance?: number | null;
  } | null;

  const lines = invoice?.lines?.data ?? [];
  const isShipping = (l: { description?: string | null }) =>
    (l.description ?? "").toLowerCase().includes("shipping");
  const isConsultation = (l: { description?: string | null }) =>
    (l.description ?? "").toLowerCase().includes("consultation");
  const shippingCents = lines
    .filter((l) => (l.amount ?? 0) > 0 && isShipping(l))
    .reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const consultationCents = lines
    .filter((l) => (l.amount ?? 0) > 0 && isConsultation(l))
    .reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const planPriceCents = lines
    .filter((l) => (l.amount ?? 0) > 0 && !isShipping(l) && !isConsultation(l))
    .reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const discounts = lines
    .filter((l) => (l.amount ?? 0) < 0)
    .map((l) => ({
      label: l.description ?? "Discount",
      amount: Math.abs(l.amount ?? 0) / 100,
    }));
  const walletUsed = ((invoice?.ending_balance ?? 0) - (invoice?.starting_balance ?? 0)) / 100;

  const planPrice = planPriceCents > 0 ? planPriceCents / 100 : pkg ? Number(pkg.price) : null;
  const shipping = shippingCents / 100;
  const consultation = consultationCents / 100;

  // First onboarding order never carries shipping; surface the renewal shipping fee so the
  // patient knows it applies from the next automatic payment onward.
  const settings = await getPlatformSettings();
  const renewalShipping = effectiveShippingCents(settings) / 100;
  const showRenewalNote = shipping === 0 && renewalShipping > 0;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const email = profile?.email ?? user.email ?? "";

  return (
    <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          <h1 className="text-3xl font-semibold text-[#2E00AB]">Payment Successful</h1>
          <p className="text-sm text-[#2E00AB]/75">
            Your treatment plan is confirmed. A receipt has been sent to your email.
          </p>
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-[#2E00AB]/20 bg-white">
          <div className="bg-[#EDE7FA] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#2E00AB]">Order Summary</h2>
          </div>
          <div className="space-y-4 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#2E00AB]/80">Medication</span>
              <span className="font-medium text-[#2E00AB]">
                {med?.name ?? "Selected Medication"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#2E00AB]/80">Plan</span>
              <span className="font-medium text-[#2E00AB]">{pkg?.name ?? "Treatment Plan"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#2E00AB]/80">Email</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-[#2E00AB]">{email}</span>
                <Link
                  href="/change-email?redirect=/order-confirmation"
                  className="shrink-0 text-xs font-medium text-[#2E00AB] underline"
                >
                  Edit
                </Link>
              </span>
            </div>
            {planPrice != null ? (
              <div className="flex justify-between border-t border-[#2E00AB]/10 pt-4">
                <span className="text-[#2E00AB]/80">Plan price</span>
                <span className="font-medium text-[#2E00AB]">${planPrice.toFixed(2)}</span>
              </div>
            ) : null}
            {planPrice != null ? (
              <div className="flex justify-between">
                <span className="text-[#2E00AB]/80">Consultation fee</span>
                <span
                  className={
                    consultation > 0
                      ? "font-medium text-[#2E00AB]"
                      : "font-semibold text-emerald-700"
                  }
                >
                  {consultation > 0 ? `$${consultation.toFixed(2)}` : "FREE"}
                </span>
              </div>
            ) : null}
            {planPrice != null ? (
              <div className="flex justify-between">
                <span className="text-[#2E00AB]/80">Shipping</span>
                <span
                  className={
                    shipping > 0 ? "font-medium text-[#2E00AB]" : "font-semibold text-emerald-700"
                  }
                >
                  {shipping > 0 ? `$${shipping.toFixed(2)}` : "FREE"}
                </span>
              </div>
            ) : null}
            {discounts.map((d) => (
              <div key={d.label} className="flex justify-between text-emerald-700">
                <span>{d.label}</span>
                <span className="font-medium">-${d.amount.toFixed(2)}</span>
              </div>
            ))}
            {walletUsed > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Wallet credit applied</span>
                <span className="font-medium">-${walletUsed.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-[#2E00AB]/10 pt-4">
              <span className="text-base font-medium text-[#2E00AB]">Total Paid</span>
              <span className="text-3xl font-semibold text-[#2E00AB]">
                {totalPaid != null ? `$${totalPaid.toFixed(2)}` : "—"}
              </span>
            </div>
            {showRenewalNote ? (
              <p className="rounded-lg bg-[#2E00AB]/5 px-3 py-2 text-xs leading-relaxed text-[#2E00AB]/80">
                This payment covers medication only. Starting with your next renewal, a $
                {renewalShipping.toFixed(2)} shipping fee will be added to each automatic payment.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-md bg-[#2E00AB] px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-[#24008A]"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/my-meds"
            className="rounded-md border border-[#2E00AB]/40 px-6 py-2.5 text-center text-sm font-medium text-[#2E00AB]"
          >
            View Treatment Details
          </Link>
        </div>
      </div>
    </main>
  );
}
