import { CreditCard, Wallet } from "lucide-react";

export default function PaymentForm() {
  return (
    <div className="rounded-[16px] border border-[#2E00AB]/20 bg-white p-4">
      <div className="mb-3 flex items-center justify-between border-b border-[#2E00AB]/10 pb-2">
        <h2 className="text-lg font-semibold text-[#2E00AB]">Payment Details</h2>
        <div className="flex gap-2 text-[#2E00AB]">
          <CreditCard size={20} />
          <Wallet size={20} />
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <label htmlFor="cardholder" className="mb-1 block text-sm text-[#2E00AB]/80">
            Cardholder Name
          </label>
          <input
            id="cardholder"
            type="text"
            placeholder="Name as shown on card"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div>
          <label htmlFor="card-number" className="mb-1 block text-sm text-[#2E00AB]/80">
            Card Number
          </label>
          <input
            id="card-number"
            type="text"
            placeholder="0000 0000 0000 0000"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2E00AB]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="expiry" className="mb-1 block text-sm text-[#2E00AB]/80">
              Expiration Date
            </label>
            <input
              id="expiry"
              type="text"
              placeholder="MM / YY"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2E00AB]"
            />
          </div>

          <div>
            <label htmlFor="cvv" className="mb-1 block text-sm text-[#2E00AB]/80">
              Security Code (CVV)
            </label>
            <input
              id="cvv"
              type="password"
              placeholder="••••"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2E00AB]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
