import { CreditCard, Plus } from "lucide-react";

import type { CheckoutPaymentMethod, CheckoutPaymentMethodId } from "./types";

type PaymentMethodsSectionProps = {
  methods: CheckoutPaymentMethod[];
  selectedMethod: CheckoutPaymentMethodId;
  onSelect: (method: CheckoutPaymentMethodId) => void;
};

export default function PaymentMethodsSection({
  methods,
  selectedMethod,
  onSelect,
}: PaymentMethodsSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-2xl font-semibold text-[#152A51]">Payment History</h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {methods.map((method) => {
          const active = selectedMethod === method.id;
          const icon = method.id === "new" ? "plus" : "card";
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelect(method.id)}
              className={`rounded-md border p-4 text-left transition ${
                active ? "border-[#6A9B9C] bg-[#F3F6F6]" : "border-[#E8EEED] bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                {icon === "card" ? (
                  <CreditCard className="h-5 w-5 text-[#152A51]/80" />
                ) : (
                  <Plus className="h-5 w-5 text-[#152A51]/80" />
                )}
              </div>
              <p className="mt-4 text-xl font-semibold text-[#152A51]">{method.title}</p>
              {method.subtitle ? (
                <p className="text-sm text-[#152A51]/70">{method.subtitle}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
