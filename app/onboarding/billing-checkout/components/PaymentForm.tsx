import { CreditCard, Wallet } from "lucide-react";

export default function PaymentForm() {
  return (
    <div className="rounded-[12px] border border-[#2E00AB]/20 bg-white p-3">
      <div className="mb-2 flex items-center justify-between border-b border-[#2E00AB]/10 pb-1.5">
        <h2 className="text-sm font-semibold text-[#2E00AB] sm:text-base">Payment Details</h2>
        <div className="flex gap-1.5 text-[#2E00AB]">
          <CreditCard size={16} />
          <Wallet size={16} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="cardholder" className="mb-0.5 block text-xs text-[#2E00AB]/80">
            Cardholder Name
          </label>
          <input
            id="cardholder"
            type="text"
            placeholder="Name as shown on card"
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="card-number" className="mb-0.5 block text-xs text-[#2E00AB]/80">
            Card Number
          </label>
          <input
            id="card-number"
            type="text"
            placeholder="0000 0000 0000 0000"
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div>
          <label htmlFor="expiry" className="mb-0.5 block text-xs text-[#2E00AB]/80">
            Expiration Date
          </label>
          <input
            id="expiry"
            type="text"
            placeholder="MM / YY"
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div>
          <label htmlFor="cvv" className="mb-0.5 block text-xs text-[#2E00AB]/80">
            Security Code (CVV)
          </label>
          <input
            id="cvv"
            type="password"
            placeholder="••••"
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#2E00AB]"
          />
        </div>
      </div>
    </div>
  );
}
