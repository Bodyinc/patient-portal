"use client";

import { DEFAULT_PHONE_COUNTRY_CODE, digitsOnlyPhone, phoneNationalLength } from "@/lib/validation";
import { cn } from "@/lib/utils";

type PhoneFieldProps = {
  id?: string;
  phone: string;
  phoneCountryCode: string;
  onPhoneChange: (phone: string) => void;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
};

export function PhoneField({
  id = "phone",
  phone,
  phoneCountryCode,
  onPhoneChange,
  className,
  selectClassName,
  inputClassName,
}: PhoneFieldProps) {
  const countryCode = phoneCountryCode || DEFAULT_PHONE_COUNTRY_CODE;
  const maxLength = phoneNationalLength(countryCode);

  return (
    <div
      className={cn(
        "flex h-[45px] items-stretch overflow-hidden rounded-[14px] bg-[#E8EEED]",
        className,
      )}
    >
      <span
        aria-label="Country calling code"
        className={cn(
          "flex h-full w-auto shrink-0 items-center rounded-none border-0 bg-transparent px-3 text-[14px] font-medium text-[#152A51]/70",
          selectClassName,
        )}
      >
        {DEFAULT_PHONE_COUNTRY_CODE}
      </span>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={maxLength}
        value={phone}
        onChange={(event) => onPhoneChange(digitsOnlyPhone(event.target.value, countryCode))}
        placeholder={"1234567890".slice(0, maxLength)}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-3 text-[14px] text-[#152A51] outline-none placeholder:text-[#152A51]/40",
          inputClassName,
        )}
        aria-label="Phone number"
      />
    </div>
  );
}
