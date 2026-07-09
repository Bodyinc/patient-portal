import Link from "next/link";
import { Truck } from "lucide-react";

export default function DeliverySupportBanner() {
  return (
    <section className="rounded-md border border-[#E6DEFF] bg-[#F3EFFF] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#EDE7FF]">
            <Truck className="h-5 w-5 text-[#2E00AB]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#2E00AB]">
              Having Trouble with Your Medication Delivery?
            </p>
            <p className="mt-1 text-sm text-[#2E00AB]/70">
              If your order is delayed or you need assistance, our support team is here to help.
            </p>
          </div>
        </div>

        <Link
          href="/settings"
          className="inline-flex w-full items-center justify-center rounded-md border border-[#2E00AB] px-4 py-2 text-sm font-medium text-[#2E00AB] hover:bg-[#EDE7FF] sm:w-auto"
        >
          Contact Support
        </Link>
      </div>
    </section>
  );
}
