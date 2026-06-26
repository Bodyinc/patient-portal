export default function PricingCard() {
  const features = [
    "Medication Included",
    "Progress Tracking",
    "Personalized Treatment Plan",
    "Clinician Support",
    "Ongoing Monitoring",
  ];

  return (
    <div className="flex justify-center">
      <div className="relative w-[640px] rounded-3xl border border-[#2E00AB]/20 bg-white p-10">
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#2E00AB] text-white px-6 py-2 rounded-md text-sm font-semibold">
          Most Popular
        </div>

        <h2 className="text-center text-3xl font-semibold text-[#2E00AB]">
          Standard Treatment Plan
        </h2>

        <div className="flex justify-center items-end gap-3 mt-8">
          <span className="text-2xl line-through text-[#2E00AB]">$197</span>

          <span className="text-6xl font-bold text-[#2E00AB]">$167</span>

          <span className="text-xl text-[#2E00AB]">Save $30</span>
        </div>

        <p className="text-center text-[#2E00AB] mt-3">Total for 3 Months</p>

        <div className="mt-8 space-y-5">
          {features.map((feature) => (
            <div key={feature}>
              <hr className="mb-4 border-[#2E00AB]/20" />

              <p className="text-center text-[#2E00AB]">{feature}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
