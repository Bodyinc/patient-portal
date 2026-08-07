"use client";

type TermsCheckboxProps = {
  checked: boolean;
  onChange: (accepted: boolean) => void;
};

export default function TermsCheckbox({ checked, onChange }: TermsCheckboxProps) {
  return (
    <label
      htmlFor="consent"
      className="flex shrink-0 cursor-pointer items-start gap-2.5 px-1 py-2 onboarding-font"
    >
      <input
        id="consent"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#152A51]"
      />
      <span className="text-[12px] leading-snug text-[#152A51]/80 sm:text-[13px]">
        I agree to the{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#152A51] underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <a
          href="https://bodyinc.com/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#152A51] underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Privacy Policy
        </a>
      </span>
    </label>
  );
}
