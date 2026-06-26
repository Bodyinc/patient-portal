import Image from "next/image";

import PlanToggle from "./components/PlanToggle";
import PricingCard from "./components/PricingCard";
import FooterButtons from "./components/FooterButtons";

export default function RecommendedPage() {
  return (
    <main className="min-h-screen bg-white px-10 py-10">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />
      <Image src="/logo.svg" alt="Body Inc" width={170} height={55} />

      <div className="text-center mt-12">
        <h1 className="text-[32px] font-semibold text-[#2E00AB]">
          Recommended Medications For You
        </h1>

        <p className="mt-4 text-[20px] text-[#2E00AB]/80 max-w-4xl mx-auto">
          Based on your initial health assessment, our clinical logic has identified several
          treatment options that may be suitable for your profile. Please review these
          recommendations carefully before selecting a path.
        </p>
      </div>

      <PlanToggle />

      <PricingCard />

      <p className="text-center mt-10 text-[#2E00AB]/80 text-[20px]">
        *Clinical data suggests patients on 3+ month programs see 24% better outcomes on average
        compared to shorter duration.
      </p>

      <FooterButtons />
    </main>
  );
}
