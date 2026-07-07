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
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-[#2E00AB]">Payment History</h3>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {methods.map((method) => {
          const active = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelect(method.id)}
              className={`rounded-2xl border p-5 text-left transition-all ${
                active 
                  ? "border-[#2E00AB] bg-[#F8F4FF]" 
                  : "border-[#E6DEFF] hover:border-[#D4C8FF] bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                {method.id === "new" ? (
                  <Plus className="h-6 w-6 text-[#2E00AB]/70" />
                ) : (
                  <CreditCard className="h-6 w-6 text-[#2E00AB]/70" />
                )}
              </div>

              <p className="mt-6 text-lg font-semibold text-[#2E00AB]">{method.title}</p>
              {method.subtitle && (
                <p className="text-sm text-[#2E00AB]/70 mt-1">{method.subtitle}</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}