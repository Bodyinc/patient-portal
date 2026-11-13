import Link from "next/link";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { formatPortalDate } from "@/lib/date-format";
import { loadMedicineChange } from "@/lib/orders/medicine-change";
import MedicineChangeActions from "./_components/MedicineChangeActions";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function MedicineChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { user } = await requirePatientSession();
  const { requestId } = await params;
  const { action } = await searchParams;
  const change = await loadMedicineChange(user.id, requestId);
  const emphasized =
    action === "decline" || action === "approve" || action === "reject" || action === "pay"
      ? action
      : null;

  return (
    <main className="min-w-0 flex-1 bg-[#F3F6F6] p-3 sm:p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href="/my-meds" className="text-sm font-medium text-[#152A51] hover:opacity-80">
          ← Back to My Meds
        </Link>

        {!change ? (
          <div className="rounded-xl border border-[#152A51]/15 bg-white p-6 text-sm text-[#152A51]/70">
            This change could not be found.
          </div>
        ) : (
          <section className="space-y-4 rounded-xl border border-[#152A51]/15 bg-white p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#152A51]/60">{change.orderNumber}</p>
              <h1 className="text-xl font-semibold text-[#152A51]">{change.medicineName}</h1>
              {change.planName ? (
                <p className="text-sm text-[#152A51]/70">{change.planName}</p>
              ) : null}
            </div>

            {change.mode === "closed" ? (
              <p className="text-sm leading-relaxed text-[#152A51]/80">
                This change has already been answered. Your order is no longer waiting on this
                decision.
              </p>
            ) : change.mode === "payment" ? (
              <>
                <p className="text-sm leading-relaxed text-[#152A51]/80">
                  Your clinician changed your medicine. The new one costs{" "}
                  <strong>{money(change.amountCents)}</strong> more. You can pay the difference or
                  decline the change.
                </p>
                <p className="text-sm leading-relaxed text-[#152A51]/80">
                  If you pay, the updated order is sent to the pharmacy automatically. If you
                  decline, you are not charged, the pending charge is cancelled, and the order
                  returns to the previous medicine and plan under review.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-[#152A51]/80">
                  Your clinician changed your medicine. Nothing extra is due. There is no payment.
                  Please approve or reject this change.
                </p>
                {change.creditCents > 0 ? (
                  <p className="text-sm leading-relaxed text-[#152A51]/80">
                    If you approve, a credit of <strong>{money(change.creditCents)}</strong> is
                    applied to your next bill. If you reject, that credit is not applied.
                  </p>
                ) : null}
                <p className="text-sm leading-relaxed text-[#152A51]/80">
                  If you approve, the updated order is sent to the pharmacy automatically. If you
                  reject, nothing is charged and the order returns to the previous medicine and plan
                  under review.
                </p>
              </>
            )}

            {change.mode !== "closed" && change.deadline ? (
              <p className="text-sm text-[#152A51]/70">
                Respond by {formatPortalDate(change.deadline)}. If you do neither, the previous
                medicine and plan are restored and you are not charged.
              </p>
            ) : null}

            {change.mode === "closed" ? (
              <Link
                href="/my-meds"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90"
              >
                View my meds
              </Link>
            ) : (
              <MedicineChangeActions
                requestId={change.requestId}
                mode={change.mode}
                amountCents={change.amountCents}
                emphasized={emphasized}
              />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
