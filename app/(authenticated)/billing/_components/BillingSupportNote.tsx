"use client";

import { patientSupportEmail } from "@/lib/support-contact";

export default function BillingSupportNote() {
  const supportEmail = patientSupportEmail();

  return (
    <section className="rounded-md border border-[#E8EEED] bg-[#F3F6F6] px-4 py-3 text-sm text-[#152A51]/80">
      <p>
        Need help with a payment or refund question? Contact support at{" "}
        <a
          href={`mailto:${supportEmail}`}
          className="font-medium text-[#152A51] underline underline-offset-2"
        >
          {supportEmail}
        </a>
        . You can cancel upcoming renewals from Your Subscriptions above; cancelling does not refund
        an already-paid period.
      </p>
    </section>
  );
}
