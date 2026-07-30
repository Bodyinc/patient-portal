"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type CheckoutActionsProps = {
  termsAccepted: boolean;
  onTermsChange: (checked: boolean) => void;
  continueDisabled?: boolean;
  onContinue: () => void;
  backHref?: string;
};

export default function CheckoutActions({
  termsAccepted,
  onTermsChange,
  continueDisabled = false,
  onContinue,
  backHref = "/shop",
}: CheckoutActionsProps) {
  const router = useRouter();

  return (
    <section className="space-y-4">
      <label className="flex items-start gap-2 text-xs leading-relaxed text-[#152A51]/80">
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={(checked) => onTermsChange(Boolean(checked))}
          className="mt-0.5 border-[#6A9B9C]/60 data-[state=checked]:border-[#6A9B9C] data-[state=checked]:bg-[#6A9B9C]"
        />
        <span>
          I agree to the Terms of Service and Privacy Policy. I understand my subscription will
          automatically renew until canceled, and I authorize recurring payments with my selected
          payment method.
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(backHref)}
          className="h-[46px] rounded-full border-[#152A51]/30 bg-white text-[#152A51] shadow-none hover:bg-[#F3F6F6]"
        >
          Back
        </Button>
        <Button
          type="button"
          disabled={!termsAccepted || continueDisabled}
          onClick={onContinue}
          className="h-[46px] rounded-full bg-[#E3E084] text-[#152A51] shadow-none hover:bg-[#D9D674]"
        >
          Continue to Payment
        </Button>
      </div>
    </section>
  );
}
