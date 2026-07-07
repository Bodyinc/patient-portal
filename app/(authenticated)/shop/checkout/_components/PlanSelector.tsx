import type { CheckoutPlan, CheckoutPlanId } from "./types";

type PlanSelectorProps = {
  plans: CheckoutPlan[];
  selectedPlan: CheckoutPlanId;
  onChange: (plan: CheckoutPlanId) => void;
};

export default function PlanSelector({ plans, selectedPlan, onChange }: PlanSelectorProps) {
  return (
    <section className="space-y-3 rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold text-[#2E00AB]">Choose Your Plan</h2>
        <p className="text-sm text-[#2E00AB]/75">
          Select the membership plan that best fits your wellness goals.
        </p>
      </div>

      {plans.map((plan) => {
        const active = selectedPlan === plan.code;
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange(plan.code)}
            className={`w-full rounded-md border p-4 text-left transition ${
              active ? "border-[#A895FF] bg-[#F6F3FF]" : "border-[#E6DEFF] bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-block h-5 w-5 rounded-full border ${
                    active ? "border-[#2E00AB] bg-[#2E00AB]" : "border-[#CFC3FF]"
                  }`}
                >
                  {active ? (
                    <span className="mt-[3px] ml-[3px] block h-2.5 w-2.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold text-[#2E00AB]">{plan.title}</p>
                    {plan.badge ? (
                      <span className="rounded-sm bg-[#6B4EFF]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#6B4EFF]">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#2E00AB]/75">{plan.subtitle}</p>
                </div>
              </div>
              <p className="text-3xl font-semibold text-[#2E00AB]">{plan.priceLabel}</p>
            </div>
          </button>
        );
      })}
    </section>
  );
}
