import type { CheckoutPlan, CheckoutPlanId } from "./types";

type PlanSelectorProps = {
  plans: CheckoutPlan[];
  selectedPlan: CheckoutPlanId;
  onChange: (plan: CheckoutPlanId) => void;
};

export default function PlanSelector({ plans, selectedPlan, onChange }: PlanSelectorProps) {
  return (
    <section className="space-y-4 rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-xl font-medium tracking-[-0.4px] text-[#152A51] sm:text-[22px]">
          Choose Your Plan
        </h2>
        <p className="text-sm text-[#152A51]/70">
          Select the membership plan that best fits your wellness goals.
        </p>
      </div>

      {plans.map((plan) => {
        const active = selectedPlan === plan.id;
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange(plan.id)}
            className={`w-full rounded-[16px] border p-4 text-left transition ${
              active
                ? "border-[#6A9B9C] bg-[#F3F6F6] shadow-[0_2px_10px_rgba(21,42,81,0.05)]"
                : "border-[#E8EEED] bg-white hover:bg-[#F8FAFA]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-block h-5 w-5 rounded-full border ${
                    active ? "border-[#6A9B9C] bg-[#6A9B9C]" : "border-[#BFCBCB]"
                  }`}
                >
                  {active ? (
                    <span className="mt-[3px] ml-[3px] block h-2.5 w-2.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-medium text-[#152A51] sm:text-[17px]">
                      {plan.title}
                    </p>
                    {plan.badge ? (
                      <span className="rounded-full bg-[#E8EEED] px-2 py-1 text-[10px] font-medium text-[#152A51]">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#152A51]/70">{plan.subtitle}</p>
                </div>
              </div>
              <p className="shrink-0 text-xl font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
                {plan.priceLabel}
              </p>
            </div>
          </button>
        );
      })}
    </section>
  );
}
