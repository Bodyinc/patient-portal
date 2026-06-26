import Image from "next/image";

import PageHeader from "./components/PageHeader";
import RecommendationBanner from "./components/RecommendationBanner";
import MedicationGrid from "./components/MedicationGrid";
import ExploreSection from "./components/ExploreSection";
import FooterButtons from "./components/FooterButtons";

export default function RecommendPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-20 py-10">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />

      <div className="relative z-10 max-w-[1600px] mx-auto">
        <PageHeader />

        <RecommendationBanner />

        <MedicationGrid />

        <ExploreSection />

        <FooterButtons />
      </div>
    </main>
  );
}
