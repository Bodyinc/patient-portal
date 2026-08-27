import "server-only";

import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
/** Tolerate a day of clock / timezone skew when comparing period ends. */
const SKEW_SECONDS = 36 * 60 * 60;

function addMonthsUnix(unixSeconds: number, months: number): number {
  const d = new Date(unixSeconds * 1000);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return Math.floor(d.getTime() / 1000);
}

function expectedPeriodEndUnix(periodStartUnix: number, durationMonths: number): number {
  const months = Math.max(1, Number(durationMonths) || 1);
  const nowUnix = Math.floor(Date.now() / 1000);
  const fromStart = addMonthsUnix(periodStartUnix, months);
  return fromStart > nowUnix ? fromStart : addMonthsUnix(nowUnix, months);
}

/** Stripe retrieve is only needed when a multi-month plan still looks like a leftover 1-month period. */
function needsLivePeriodCheck(storedEnd: string | null, durationMonths: number): boolean {
  if (!storedEnd) return true;
  const remainingMs = new Date(storedEnd).getTime() - Date.now();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return false;
  if (durationMonths <= 1) return false;
  return remainingMs / 86_400_000 < 40;
}

/**
 * When a medicine/plan change updated package_id but left current_period_end on the old
 * duration (or a deferred Stripe schedule still holds the short period), realign the
 * billing/refill date to period_start + package.duration_months.
 */
export async function maybeSyncSubscriptionPeriodEnds(userId: string): Promise<void> {
  const { data: subs, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, stripe_subscription_id, package_id, current_period_end")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .not("stripe_subscription_id", "is", null)
    .not("package_id", "is", null);

  if (error) {
    console.error("[subscriptions] period sync load failed:", error.message);
    return;
  }
  if (!subs?.length) return;

  const packageIds = [...new Set(subs.map((s) => s.package_id).filter(Boolean))] as string[];
  const { data: packages } = await supabaseAdmin
    .from("packages")
    .select("id, duration_months, stripe_price_id")
    .in("id", packageIds);
  const pkgById = new Map((packages ?? []).map((p) => [p.id, p]));

  for (const sub of subs) {
    if (!sub.stripe_subscription_id || !sub.package_id) continue;
    const pkg = pkgById.get(sub.package_id);
    if (!pkg) continue;
    if (!needsLivePeriodCheck(sub.current_period_end, pkg.duration_months)) continue;

    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const anySub = stripeSub as unknown as {
        current_period_start?: number;
        current_period_end?: number;
        schedule?: string | { id?: string } | null;
        items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
      };
      const periodStart =
        anySub.current_period_start ?? anySub.items?.data?.[0]?.current_period_start;
      const stripePeriodEnd =
        anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end;
      if (!periodStart) continue;

      const expectedEnd = expectedPeriodEndUnix(periodStart, pkg.duration_months);
      const storedEndUnix = sub.current_period_end
        ? Math.floor(new Date(sub.current_period_end).getTime() / 1000)
        : null;
      const liveEndUnix = stripePeriodEnd ?? storedEndUnix;
      if (liveEndUnix != null && Math.abs(liveEndUnix - expectedEnd) <= SKEW_SECONDS) {
        // Stripe already matches; keep DB in sync if it drifted.
        if (storedEndUnix == null || Math.abs(storedEndUnix - expectedEnd) > SKEW_SECONDS) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ current_period_end: new Date(expectedEnd * 1000).toISOString() })
            .eq("id", sub.id);
        }
        continue;
      }

      // Release a deferred next-cycle schedule so the period can be extended now.
      const existingSchedule = anySub.schedule;
      if (existingSchedule) {
        const sid = typeof existingSchedule === "string" ? existingSchedule : existingSchedule.id;
        if (sid) {
          try {
            await stripe.subscriptionSchedules.release(sid);
          } catch {
            // Already released — continue.
          }
        }
      }

      const fresh = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: sub.stripe_subscription_id,
      });
      const phase0 = schedule.phases[0] as {
        start_date?: number;
        items?: Array<{ price: string | { id?: string }; quantity?: number | null }>;
      };
      const phaseItems = (phase0.items ?? []).map((i) => ({
        price: typeof i.price === "string" ? i.price : (i.price?.id as string),
        quantity: i.quantity ?? 1,
      }));

      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
          {
            items: phaseItems,
            start_date: phase0.start_date ?? periodStart,
            end_date: expectedEnd,
            proration_behavior: "none",
            metadata: {
              ...(fresh.metadata ?? {}),
              package_id: sub.package_id,
            },
          },
        ],
      });

      await supabaseAdmin
        .from("subscriptions")
        .update({
          current_period_end: new Date(expectedEnd * 1000).toISOString(),
          ...(pkg.stripe_price_id ? { stripe_price_id: pkg.stripe_price_id } : {}),
        })
        .eq("id", sub.id);
    } catch (err) {
      console.error(
        "[subscriptions] period sync failed:",
        sub.id,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
