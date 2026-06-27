export default function PricingCard() {
  const features = [
    "Medication Included",
    "Progress Tracking",
    "Personalized Treatment Plan",
    "Clinician Support",
    "Ongoing Monitoring",
  ];

  return (
    <div className="relative w-full max-w-xl rounded-[20px] border border-[#2E00AB]/20 bg-white px-4 py-6 sm:px-8 sm:py-8">
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-md bg-[#2E00AB] px-5 py-1.5 text-sm font-semibold text-white">
        Most Popular
      </div>

      <h2 className="text-center text-xl font-semibold text-[#2E00AB] sm:text-2xl">
        Standard Treatment Plan
      </h2>

      <div className="mt-6 flex items-end justify-center gap-3">
        <span className="text-lg line-through text-[#2E00AB] sm:text-xl">$197</span>
        <span className="text-4xl font-bold leading-none text-[#2E00AB] sm:text-5xl">$167</span>
        <span className="pb-1 text-sm text-[#2E00AB] sm:text-base">Save $30</span>
      </div>

      <p className="mt-2 text-center text-base text-[#2E00AB]">Total for 3 Months</p>

      <div className="mt-6 space-y-3">
        {features.map((feature) => (
          <div key={feature}>
            <hr className="border-[#2E00AB]/20" />
            <p className="pt-3 text-center text-base text-[#2E00AB]">{feature}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
