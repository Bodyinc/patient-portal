"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type CheckoutActionsProps = {
  termsAccepted: boolean;
  onTermsChange: (checked: boolean) => void;
  continueDisabled?: boolean;
  onContinue: () => void;
};

export default function CheckoutActions({
  termsAccepted,
  onTermsChange,
  continueDisabled = false,
  onContinue,
}: CheckoutActionsProps) {
  const router = useRouter();

  return (
    <section className="space-y-6 pt-2">
      <label className="flex items-start gap-3 text-sm text-[#2E00AB]/80 cursor-pointer">
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={(checked) => onTermsChange(Boolean(checked))}
          className="mt-0.5 border-[#2E00AB]/40 data-[state=checked]:bg-[#2E00AB]"
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
          onClick={() => router.push("/shop")}
          className="h-12 rounded-full border-[#2E00AB]/30 text-[#2E00AB] hover:bg-[#F8F4FF]"
        >
          ← Back
        </Button>
        <Button
          type="button"
          disabled={!termsAccepted || continueDisabled}
          onClick={onContinue}
          className="h-12 rounded-full bg-[#2E00AB] text-white hover:bg-[#2E00AB]/90 text-base font-medium"
        >
          Continue to Payment →
        </Button>
      </div>
    </section>
  );
}