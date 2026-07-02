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

export default function PricingCard({ pkg }: PricingCardProps) {
  if (!pkg) return null;

  const features = pkg.features.length > 0 ? pkg.features : DEFAULT_FEATURES;
  const savings = pkg.originalPrice > pkg.price ? pkg.originalPrice - pkg.price : 0;

  return (
    <div className="relative w-full max-w-xl rounded-2xl border border-[#2E00AB]/20 bg-white px-4 py-4 sm:px-6 sm:py-5">
      {pkg.isMostPopular ? (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-md bg-[#2E00AB] px-5 py-1.5 text-sm font-semibold text-white">
          Most Popular
        </div>
      ) : null}

      <h2 className="text-center text-xl font-semibold text-[#2E00AB] sm:text-2xl">
        Standard Treatment Plan
      </h2>

      <div className="mt-4 flex items-end justify-center gap-2 sm:mt-5">
        {pkg.originalPrice > pkg.price ? (
          <span className="text-base line-through text-[#2E00AB] sm:text-lg">
            ${pkg.originalPrice}
          </span>
        ) : null}
        <span className="text-3xl font-bold leading-none text-[#2E00AB] sm:text-4xl">
          ${pkg.price}
        </span>
        {savings > 0 ? (
          <span className="pb-1 text-sm text-[#2E00AB] sm:text-base">Save ${savings}</span>
        ) : null}
      </div>

      <p className="mt-2 text-center text-base text-[#2E00AB]">{pkg.name}</p>

      <div className="mt-3 space-y-2">
        {features.map((feature) => (
          <div key={feature}>
            <hr className="border-[#2E00AB]/20" />
            <p className="pt-2 text-center text-sm text-[#2E00AB]">{feature}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
