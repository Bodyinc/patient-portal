import Link from "next/link";
import { Truck } from "lucide-react";

export default function DeliverySupportBanner() {
  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-[#F3F6F6] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#E8EEED]">
            <Truck className="h-5 w-5 text-[#152A51]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#152A51] sm:text-[15px]">
              Having Trouble with Your Medication Delivery?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#152A51]/70">
              If your order is delayed or you need assistance, our support team is here to help.
            </p>
          </div>
        </div>

        <Link
          href="/settings"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-[#152A51] px-5 text-sm font-medium text-[#152A51] hover:bg-white sm:w-auto"
        >
          Contact Support
        </Link>
      </div>
    </section>
  );
}
