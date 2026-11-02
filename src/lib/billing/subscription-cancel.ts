/** Stripe will end this subscription without another renewal charge. */
export function subscriptionWillCancel(sub: {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  nowMs?: number;
}): boolean {
  if (sub.status === "canceled") return true;
  if (sub.cancel_at_period_end) return true;
  if (typeof sub.cancel_at === "number" && sub.cancel_at * 1000 > (sub.nowMs ?? Date.now())) {
    return true;
  }
  return false;
}

/** Money actually collected on the invoice. A $0 "paid" invoice is not a purchase. */
export function invoiceHasCollectedPayment(
  invoice: { amount_paid?: number | null } | null | undefined,
): boolean {
  return (invoice?.amount_paid ?? 0) > 0;
}

/**
 * What to do when this browser opens checkout again.
 * Paid only when money was collected. Otherwise resume the open card form,
 * or replace the attempt so they can pay from the same checkout.
 */
export function unpaidCheckoutAction(input: {
  status: string;
  amountPaid: number;
  samePackage: boolean;
  hasClientSecret: boolean;
}): "paid" | "resume" | "replace" {
  const collected = input.amountPaid > 0;
  if (collected && (input.status === "active" || input.status === "trialing")) {
    return "paid";
  }
  if (
    input.samePackage &&
    input.hasClientSecret &&
    (input.status === "incomplete" || input.status === "past_due")
  ) {
    return "resume";
  }
  return "replace";
}

/** A sentence the patient can read when cancellation does not go through. */
export function patientCancelError(raw: unknown): string {
  const message = (raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "")
    .replace(/\s+/g, " ")
    .trim();
  if (!message) return "We couldn't cancel that subscription. Please try again.";
  if (/already.*(cancel|scheduled)/i.test(message)) {
    return "This subscription is already set to cancel at the end of the period you paid for.";
  }
  if (/subscription schedule/i.test(message)) {
    return "This plan is on a billing schedule, so the cancel did not go through. Please try again. If it fails again, contact support and mention a billing schedule.";
  }
  if (/no such subscription/i.test(message)) {
    return "We couldn't find this subscription with the payment provider. Refresh Billing and try again.";
  }
  if (/not active|incomplete|past_due/i.test(message)) {
    return "This subscription can't be cancelled right now because it isn't an active paid plan. Refresh Billing and try again.";
  }
  if (
    message.length <= 180 &&
    !/sk_|api[_ ]key|postgres|violates|password|stack|select |insert |update /i.test(message)
  ) {
    return `We couldn't cancel that subscription. ${message}`;
  }
  return "We couldn't cancel that subscription. Please refresh Billing and try again. If it keeps failing, contact support.";
}

/** Keep the later billing date so a cancel never shortens an already-paid period. */
export function laterIso(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const aMs = a ? new Date(a).getTime() : NaN;
  const bMs = b ? new Date(b).getTime() : NaN;
  const aOk = Number.isFinite(aMs);
  const bOk = Number.isFinite(bMs);
  if (aOk && bOk) return aMs >= bMs ? a! : b!;
  if (aOk) return a!;
  if (bOk) return b!;
  return null;
}
