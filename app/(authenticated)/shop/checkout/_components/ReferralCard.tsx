import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ReferralCardProps = {
  referralHint: string;
  promoCode: string;
  onPromoCodeChange: (value: string) => void;
  onApply: () => void;
};

export default function ReferralCard({
  referralHint,
  promoCode,
  onPromoCodeChange,
  onApply,
}: ReferralCardProps) {
  return (
    <section className="rounded-2xl border border-[#E6DEFF] bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#2E00AB]">Share Wellness, Earn Rewards</h3>
          <p className="text-sm text-[#2E00AB]/75 mt-1">{referralHint}</p>
        </div>

        <div className="flex w-full max-w-md gap-2">
          <Input
            value={promoCode}
            onChange={(e) => onPromoCodeChange(e.target.value)}
            placeholder="Enter promo code"
            className="h-11 border-[#E6DEFF] focus:border-[#2E00AB]"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onApply}
            className="h-11 border-[#2E00AB] text-[#2E00AB] hover:bg-[#F8F4FF]"
          >
            Apply Code
          </Button>
        </div>
      </div>
    </section>
  );
}