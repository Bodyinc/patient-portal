import Link from "next/link";
import { requirePatientSession } from "@/lib/auth/require-patient";
import { createAdditionalPaymentIntent } from "@/lib/orders/additional-payment";
import AdditionalPaymentForm from "./_components/AdditionalPaymentForm";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100,
  );
}

export default async function AdditionalPaymentPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { user } = await requirePatientSession();
  const { requestId } = await params;

  const intent = await createAdditionalPaymentIntent({
    userId: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
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
              <p className="text-2xl font-bold text-[#152A51]">{money(intent.amountCents)}</p>
              <p className="text-xs text-[#152A51]/60">
                Once this is paid, your prescription will be generated and sent for fulfillment.
              </p>
            </div>
            <AdditionalPaymentForm
              clientSecret={intent.clientSecret}
              amountCents={intent.amountCents}
            />
          </>
        )}
      </div>
    </main>
  );
}
