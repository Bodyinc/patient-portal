import PageHeader from "./components/PageHeader";
import MedicationGrid from "./components/MedicationGrid";
import FooterButtons from "./components/FooterButtons";

export default function ChooseMedicationPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-16 py-10">
      <PageHeader />

      <MedicationGrid />

      <FooterButtons />
    </main>
  );
}
