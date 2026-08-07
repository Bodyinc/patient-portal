import Link from "next/link";
import { Truck } from "lucide-react";

export default function DeliverySupportBanner() {
  return (
    <section className="rounded-[16px] bg-[#E8EEED] px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#152A51] sm:mt-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#152A51] sm:text-[15px]">
              Having Trouble with Your Medication Delivery?
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-[#152A51]/70">
              If your order is delayed or you need assistance, our support team is here to help.
            </p>
          </div>
        </div>

        <Link
          href="mailto:admin@bodyinc.com"
          className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full border border-[#152A51] bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] sm:w-auto"
        >
          Contact Support
        </Link>
      </div>
    </section>
  );
}
