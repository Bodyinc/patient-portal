import type { PackageDto } from "@/lib/intake/types";

type PricingCardProps = {
  pkg: PackageDto | null;
};

const DEFAULT_FEATURES = [
  "Medication Included",
  "Progress Tracking",
  "Personalized Treatment Plan",
  "Clinician Support",
  "Ongoing Monitoring",
];

/** Feature list for the currently selected plan — visual companion to plan cards. */
export default function PricingCard({ pkg }: PricingCardProps) {
  if (!pkg) return null;

  const features = pkg.features.length > 0 ? pkg.features : DEFAULT_FEATURES;

  return (
    <div className="w-full rounded-[14px] border border-[#E8E8E8] bg-white px-4 py-4 onboarding-font sm:px-5 sm:py-5">
      <h2 className="text-center text-[16px] font-medium text-[#152A51] sm:text-[18px]">
        What&apos;s included
      </h2>

      <div className="mt-3 space-y-0">
        {features.map((feature) => (
          <div key={feature}>
            <hr className="border-[#E8E8E8]" />
            <p className="py-2.5 text-center text-[14px] font-normal text-[#152A51]">{feature}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
