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
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            Share Wellness, Earn Rewards
          </h3>
          <p className="text-sm text-[#152A51]/70">{referralHint}</p>
        </div>
        <div className="flex w-full max-w-sm items-center gap-2">
          <Input
            value={promoCode}
            onChange={(event) => onPromoCodeChange(event.target.value)}
            placeholder="Enter promo code"
            className="h-[45px] rounded-[14px] border-0 bg-[#E8EEED] px-4 text-sm text-[#152A51] shadow-none placeholder:text-[#152A51]/40 focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onApply}
            className="h-[45px] rounded-full border-[#152A51]/30 bg-white px-5 text-[#152A51] shadow-none hover:bg-[#F3F6F6]"
          >
            Apply Code
          </Button>
        </div>
      </div>
    </section>
  );
}
