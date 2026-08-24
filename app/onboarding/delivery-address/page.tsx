"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PhoneField } from "@/components/phone-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZipCodeInput } from "@/components/zip-code-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { saveIntakeAddress } from "@/lib/actions/intake";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  PHONE_COUNTRY_CODE_SCHEMA,
  ZIP_CODE_SCHEMA,
  OPTIONAL_ZIP_CODE_SCHEMA,
  digitsOnlyZip,
  isValidNationalPhone,
} from "@/lib/validation";

import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { US_STATES } from "../_lib/onboarding-config";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";
import { fieldControlClass, fieldLabelClass } from "../_lib/onboarding-theme";

const addressSchema = z
  .object({
    streetAddress: z.string().trim().min(1, "Enter your address"),
    apartment: z.string().trim().min(1, "Enter your apartment number"),
    postalCode: ZIP_CODE_SCHEMA,
    city: z.string().trim().min(1, "Enter your city"),
    phone: z.string().trim(),
    phoneCountryCode: PHONE_COUNTRY_CODE_SCHEMA,
    billingSameAsShipping: z.boolean(),
    billingStreetAddress: z.string().trim(),
    billingApartment: z.string().trim(),
    billingPostalCode: OPTIONAL_ZIP_CODE_SCHEMA,
    billingCity: z.string().trim(),
    billingStateCode: z.string().trim(),
    smsConsent: z.boolean(),
    marketingConsent: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!isValidNationalPhone(data.phone, data.phoneCountryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Enter a valid phone number",
      });
    }
    if (!data.smsConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smsConsent"],
        message: "Please consent to SMS communications to continue",
      });
    }
    if (data.billingSameAsShipping) return;
    const required: [keyof typeof data, string][] = [
      ["billingStreetAddress", "Enter your billing address"],
      ["billingCity", "Enter your billing city"],
      ["billingStateCode", "Select your billing state"],
      ["billingPostalCode", "Enter a billing ZIP code of up to 6 digits"],
    ];
    for (const [key, message] of required) {
      if (!String(data[key] ?? "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message });
      }
    }
  });

export default function DeliveryAddressPage() {
  const router = useRouter();
  const { state, updateState, hydrated } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    streetAddress: state.streetAddress,
    apartment: state.apartment,
    postalCode: digitsOnlyZip(state.postalCode),
    city: state.city,
    phone: state.phone,
    phoneCountryCode: state.phoneCountryCode || DEFAULT_PHONE_COUNTRY_CODE,
    billingSameAsShipping: state.billingSameAsShipping,
    billingStreetAddress: state.billingStreetAddress,
    billingApartment: state.billingApartment,
    billingPostalCode: digitsOnlyZip(state.billingPostalCode),
    billingCity: state.billingCity,
    billingStateCode: state.billingStateCode,
    smsConsent: state.smsConsent,
    marketingConsent: state.marketingConsent,
  });

  useEffect(() => {
    if (!hydrated) return;
    setForm({
      streetAddress: state.streetAddress,
      apartment: state.apartment,
      postalCode: digitsOnlyZip(state.postalCode),
      city: state.city,
      phone: state.phone,
      phoneCountryCode: state.phoneCountryCode || DEFAULT_PHONE_COUNTRY_CODE,
      billingSameAsShipping: state.billingSameAsShipping,
      billingStreetAddress: state.billingStreetAddress,
      billingApartment: state.billingApartment,
      billingPostalCode: digitsOnlyZip(state.billingPostalCode),
      billingCity: state.billingCity,
      billingStateCode: state.billingStateCode,
      smsConsent: state.smsConsent,
      marketingConsent: state.marketingConsent,
    });
  }, [
    hydrated,
    state.streetAddress,
    state.apartment,
    state.postalCode,
    state.city,
    state.phone,
    state.phoneCountryCode,
    state.billingSameAsShipping,
    state.billingStreetAddress,
    state.billingApartment,
    state.billingPostalCode,
    state.billingCity,
    state.billingStateCode,
    state.smsConsent,
    state.marketingConsent,
  ]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleContinue() {
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the required fields");
      return;
    }

    const patch = parsed.data;

    setSaving(true);
    const result = await saveIntakeAddress(patch);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    updateState(patch);
    const next = getNextStepPath("/onboarding/delivery-address", { ...state, ...patch });
    if (next) await pushOnboardingRoute(router, next);
  }

  async function handleBack() {
    const prev = getPrevStepPath("/onboarding/delivery-address", state);
    if (prev) await pushOnboardingRoute(router, prev);
  }

  return (
    <OnboardingStepLayout
      title="Where should we ship your prescription?"
      description="If your treatment is approved by a licensed provider, we'll securely ship it to this address."
      onBack={handleBack}
      onContinue={handleContinue}
      continueLabel="Find your treatment"
      continueDisabled={saving}
      maxWidth="form"
      variant="bare"
      align="center"
      layout="fill"
    >
      <div className="space-y-6 text-left">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
          <div className="space-y-4 sm:col-span-2">
            <Label htmlFor="streetAddress" className={fieldLabelClass}>
              Address <span className="text-[#152A51]/50">*</span>
            </Label>
            <Input
              id="streetAddress"
              autoComplete="address-line1"
              autoFocus
              value={form.streetAddress}
              onChange={(e) => setField("streetAddress", e.target.value)}
              placeholder="456 Oak Avenue"
              className={fieldControlClass}
            />
          </div>
          <div className="space-y-4">
            <Label htmlFor="apartment" className={fieldLabelClass}>
              Apartment number <span className="text-[#152A51]/50">*</span>
            </Label>
            <Input
              id="apartment"
              autoComplete="address-line2"
              value={form.apartment}
              onChange={(e) => setField("apartment", e.target.value)}
              placeholder="Unit 12B"
              className={fieldControlClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
          <div className="space-y-4">
            <Label htmlFor="postalCode" className={fieldLabelClass}>
              Zip code <span className="text-[#152A51]/50">*</span>
            </Label>
            <ZipCodeInput
              id="postalCode"
              value={form.postalCode}
              onChange={(value) => setField("postalCode", value)}
              placeholder="90210"
              className={fieldControlClass}
            />
          </div>
          <div className="space-y-4 sm:col-span-2">
            <Label htmlFor="city" className={fieldLabelClass}>
              City <span className="text-[#152A51]/50">*</span>
            </Label>
            <Input
              id="city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Los Angeles"
              className={fieldControlClass}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#152A51]">
          <Checkbox
            checked={form.billingSameAsShipping}
            onCheckedChange={(checked) => setField("billingSameAsShipping", checked === true)}
            className="border-[#152A51]/30 data-[state=checked]:border-[#152A51] data-[state=checked]:bg-[#152A51]"
          />
          Billing address is the same as shipping
        </label>

        {!form.billingSameAsShipping && (
          <div className="space-y-4 rounded-[14px] border border-[#E8E8E8] bg-[#F7F8FA] p-4">
            <p className="text-[14px] font-medium text-[#152A51]">Billing address</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
              <div className="space-y-4 sm:col-span-2">
                <Label htmlFor="billingStreetAddress" className={fieldLabelClass}>
                  Address <span className="text-[#152A51]/50">*</span>
                </Label>
                <Input
                  id="billingStreetAddress"
                  value={form.billingStreetAddress}
                  onChange={(e) => setField("billingStreetAddress", e.target.value)}
                  placeholder="123, Main Street"
                  className={fieldControlClass}
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="billingApartment" className={fieldLabelClass}>
                  Apartment number
                </Label>
                <Input
                  id="billingApartment"
                  value={form.billingApartment}
                  onChange={(e) => setField("billingApartment", e.target.value)}
                  placeholder="1A"
                  className={fieldControlClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
              <div className="space-y-4">
                <Label htmlFor="billingPostalCode" className={fieldLabelClass}>
                  Zip code <span className="text-[#152A51]/50">*</span>
                </Label>
                <ZipCodeInput
                  id="billingPostalCode"
                  value={form.billingPostalCode}
                  onChange={(value) => setField("billingPostalCode", value)}
                  placeholder="12345"
                  className={fieldControlClass}
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="billingCity" className={fieldLabelClass}>
                  City <span className="text-[#152A51]/50">*</span>
                </Label>
                <Input
                  id="billingCity"
                  value={form.billingCity}
                  onChange={(e) => setField("billingCity", e.target.value)}
                  placeholder="Phoenix"
                  className={fieldControlClass}
                />
              </div>
              <div className="space-y-4">
                <Label htmlFor="billingStateCode" className={fieldLabelClass}>
                  State <span className="text-[#152A51]/50">*</span>
                </Label>
                <Select
                  value={form.billingStateCode || undefined}
                  onValueChange={(value) => {
                    if (!value) return;
                    setField("billingStateCode", value);
                  }}
                >
                  <SelectTrigger id="billingStateCode" className={cn(fieldControlClass, "w-full")}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Label htmlFor="phone" className={fieldLabelClass}>
            Phone number <span className="text-[#152A51]/50">*</span>
          </Label>
          <PhoneField
            id="phone"
            phone={form.phone}
            phoneCountryCode={form.phoneCountryCode}
            onPhoneChange={(phone) => setField("phone", phone)}
          />
          <p className="text-[12px] leading-snug text-[#152A51]/70">
            We&apos;ll only use your number to text order updates and important information about
            your treatments.
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-[#152A51]/80">
            <Checkbox
              className="mt-0.5 rounded-full border-[#152A51]/30 data-[state=checked]:border-[#152A51] data-[state=checked]:bg-[#152A51]"
              checked={form.smsConsent}
              onCheckedChange={(checked) => setField("smsConsent", checked === true)}
            />
            <span>
              I consent to receive SMS/text messages related to my care, including appointment
              reminders, intake updates, account notifications, and care-related communications from
              OpenLoop on behalf of Fridays Health. I acknowledge that using these communication
              methods presents a potential security risk of unauthorized access to protected health
              information (PHI), and I accept this risk and consent to receiving communications
              through these methods. I understand that message and data rates may apply and that I
              can opt out of receiving SMS messages at any time by replying STOP.
              <span className="font-semibold text-red-600"> *</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-[#152A51]/80">
            <Checkbox
              className="mt-0.5 rounded-full border-[#152A51]/30 data-[state=checked]:border-[#152A51] data-[state=checked]:bg-[#152A51]"
              checked={form.marketingConsent}
              onCheckedChange={(checked) => setField("marketingConsent", checked === true)}
            />
            <span>
              I&apos;d also like to receive occasional promotions via call and text message. Opt out
              anytime.
            </span>
          </label>
        </div>

        <p className="text-[11px] leading-relaxed text-[#152A51]/50">
          By checking the option &quot;I&apos;d also like to receive occasional promotions via text
          message. Opt out anytime.&quot;, I agree to receive marketing text messages from Fridays
          Health at the number provided above. Messages &amp; calls may use an automatic telephone
          dialing system. Consent is not required as a condition of purchase. Message and data rates
          may apply. Message frequency varies. Send HELP for help or STOP to cancel. Messages &amp;
          calls may include shopping cart reminders.
        </p>
      </div>
    </OnboardingStepLayout>
  );
}
