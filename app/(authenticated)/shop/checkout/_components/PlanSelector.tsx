import type { CheckoutPlan, CheckoutPlanId } from "./types";

type PlanSelectorProps = {
  plans: CheckoutPlan[];
  selectedPlan: CheckoutPlanId;
  onChange: (plan: CheckoutPlanId) => void;
};

export default function PlanSelector({ plans, selectedPlan, onChange }: PlanSelectorProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-[#E6DEFF] bg-white p-6">
      <div className="space-y-1">
        <h2 className="text-[22px] font-semibold text-[#2E00AB]">Choose Your Plan</h2>
        <p className="text-sm text-[#2E00AB]/75">
          Select the membership plan that best fits your wellness goals.
        </p>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => {
          const active = selectedPlan === plan.code;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange(plan.code)}
              className={`w-full rounded-2xl border p-5 text-left transition-all ${
                active 
                  ? "border-[#2E00AB] bg-[#F8F4FF]" 
                  : "border-[#E6DEFF] hover:border-[#D4C8FF]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-1 inline-block h-5 w-5 shrink-0 rounded-full border-2 ${
                      active 
                        ? "border-[#2E00AB] bg-[#2E00AB]" 
                        : "border-[#CFC3FF]"
                    }`}
                  >
                    {active && (
                      <span className="block h-2.5 w-2.5 mt-[3px] ml-[3px] rounded-full bg-white" />
                    )}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-[#2E00AB]">{plan.title}</p>
                      {plan.badge && (
                        <span className="rounded-md bg-[#6B4EFF] px-2.5 py-0.5 text-xs font-medium text-white">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#2E00AB]/70 mt-1">{plan.subtitle}</p>
                  </div>
                </div>

                <p className="text-xl font-semibold text-[#2E00AB] whitespace-nowrap">
                  {plan.priceLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}