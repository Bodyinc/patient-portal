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
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-[#2E00AB]">Share Wellness, Earn Rewards</h3>
          <p className="text-sm text-[#2E00AB]/75">{referralHint}</p>
        </div>
        <div className="flex w-full max-w-sm items-center gap-2">
          <Input
            value={promoCode}
            onChange={(event) => onPromoCodeChange(event.target.value)}
            placeholder="Enter promo code"
            className="h-10 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onApply}
            className="h-10 border-[#2E00AB]/30 text-[#2E00AB]"
          >
            Apply Code
          </Button>
        </div>
      </div>
    </section>
  );
}
