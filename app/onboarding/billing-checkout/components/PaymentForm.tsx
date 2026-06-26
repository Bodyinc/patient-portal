import { CreditCard, Wallet } from "lucide-react";
export default function PaymentForm() {
  return (
    <div className="mt-6 rounded-xl border border-[#2E00AB]/20 bg-white p-6">
      <div className="flex items-center justify-between border-b border-[#2E00AB]/10 pb-4">
        <h2 className="text-2xl font-semibold text-[#2E00AB]">Patient Information</h2>

        <div className="flex gap-3 text-[#2E00AB]">
          <CreditCard size={20} />
          <Wallet size={20} />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="block mb-2 text-sm text-[#2E00AB]/80">Cardholder Name</label>

          <input
            type="text"
            placeholder="Name as shown on card"
            className="w-full rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div>
          <label className="block mb-2 text-sm text-[#2E00AB]/80">Card Number</label>

          <input
            type="text"
            placeholder="0000 0000 0000 0000"
            className="w-full rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block mb-2 text-sm text-[#2E00AB]/80">Expiration Date</label>

            <input
              type="text"
              placeholder="MM / YY"
              className="w-full rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-[#2E00AB]"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-[#2E00AB]/80">Security Code (CVV)</label>

            <input
              type="password"
              placeholder="••••"
              className="w-full rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-[#2E00AB]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
