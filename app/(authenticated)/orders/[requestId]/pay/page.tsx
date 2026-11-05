import Link from "next/link";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { createAdditionalPaymentIntent } from "@/lib/orders/additional-payment";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import AdditionalPaymentForm from "./_components/AdditionalPaymentForm";

export default async function AdditionalPaymentPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { user } = await requirePatientSession();
  const { requestId } = await params;

  const identity = await getPatientDisplayIdentity(user.id);
  const intent = await createAdditionalPaymentIntent({
    userId: user.id,
    email: user.email ?? null,
    name: identity.stripeName,
    requestId,
  });

  return (
    <main className="min-w-0 flex-1 bg-[#F3F6F6] p-3 sm:p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href="/my-meds" className="text-sm font-medium text-[#152A51] hover:opacity-80">
          ← Back to My Meds
        </Link>

        {!intent ? (
          <div className="rounded-xl border border-[#152A51]/15 bg-white p-6 text-center text-sm text-[#152A51]/70">
            There&apos;s no payment due on this order.
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-[#152A51]">Additional payment</h1>
              <p className="text-sm text-[#152A51]/70">
                {intent.reason ?? `Price difference for ${intent.medicineName}`}
              </p>
            </div>
            <AdditionalPaymentForm
              requestId={requestId}
              clientSecret={intent.clientSecret}
              amountCents={intent.amountCents}
              originalAmountCents={intent.originalAmountCents}
              discountCents={intent.discountCents}
              promoLabel={intent.promoLabel}
            />
          </>
        )}
      </div>
    </main>
  );
}
