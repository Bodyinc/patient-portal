"use client";

import { cn } from "@/lib/utils";

type TermsCheckboxProps = {
  checked: boolean;
  invalid: boolean;
  onChange: (accepted: boolean) => void;
};

export default function TermsCheckbox({ checked, invalid, onChange }: TermsCheckboxProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] border bg-white px-3 py-3 onboarding-font transition-colors",
        invalid ? "border-red-500 bg-red-50" : "border-[#E8E8E8]",
      )}
    >
      <label htmlFor="consent" className="flex cursor-pointer items-start gap-3">
        <input
          id="consent"
          type="checkbox"
          checked={checked}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "consent-error" : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className={cn("mt-0.5 h-5 w-5 shrink-0", invalid ? "accent-red-600" : "accent-[#152A51]")}
        />
        <span
          className={cn(
            "text-[13px] leading-snug sm:text-[14px]",
            invalid ? "text-red-700" : "text-[#152A51]",
          )}
        >
          I agree to the{" "}
          <a
            href="https://www.bodyinc.com/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
            onClick={(e) => e.stopPropagation()}
          >
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a
            href="https://www.bodyinc.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </a>
        </span>
      </label>
      {invalid ? (
        <p
          id="consent-error"
          role="alert"
          className="mt-2 pl-8 text-[13px] font-medium text-red-600"
        >
          Accept the policies to continue.
        </p>
      ) : null}
    </div>
  );
}
