export default function OrderSummary() {
  return (
    <div className="rounded-xl border border-[#2E00AB]/20 bg-white p-6">
      <h2 className="border-b border-[#2E00AB]/10 pb-4 text-2xl font-semibold text-[#2E00AB]">
        Order Summary
      </h2>

      <div className="mt-6 space-y-6">
        <div className="flex justify-between">
          <div>
            <p className="font-medium text-[#2E00AB]">Personalized Wellness Plan</p>

            <p className="text-sm text-[#2E00AB]/70">3-Month Membership Program</p>
          </div>

          <p className="font-semibold text-[#2E00AB]">$149.00</p>
        </div>

        <div className="flex justify-between border-b border-[#2E00AB]/10 pb-5">
          <div>
            <p className="font-medium text-[#2E00AB]">Initial Provider Consultation</p>

            <p className="text-sm text-[#2E00AB]/70">Required Clinical Assessment</p>
          </div>

          <p className="font-semibold text-[#2E00AB]">$35.00</p>
        </div>

        <div className="space-y-3 text-[#2E00AB]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>$184.00</span>
          </div>

          <div className="flex justify-between">
            <span>Processing Fee</span>
            <span>$5.00</span>
          </div>

          <div className="flex justify-between">
            <span>Discount (WELCOME20)</span>
            <span>-$22.00</span>
          </div>

          <div className="flex justify-between">
            <span>Tax</span>
            <span>$0.00</span>
          </div>
        </div>

        <hr />

        <div className="flex justify-between items-center">
          <div>
            <p className="text-[#2E00AB]">Total Due Today</p>
          </div>

          <p className="text-4xl font-bold text-[#2E00AB]">$167.00</p>
        </div>

        <div className="flex gap-3">
          <input
            placeholder="Enter promo code"
            className="flex-1 rounded-md border border-gray-200 px-4 py-3"
          />

          <button className="rounded-md border border-[#2E00AB] px-5 text-[#2E00AB]">
            Apply Code →
          </button>
        </div>

        <button className="w-full rounded-md bg-[#2E00AB] py-4 text-white font-semibold">
          Continue to Payment
        </button>

        <p className="text-center text-sm text-[#2E00AB]/70">
          Need assistance? <span className="font-semibold">Chat with Support</span>
        </p>
      </div>
    </div>
  );
}
