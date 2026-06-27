import MedicationCard from "../../_components/MedicationCard";

export default function MedicationGrid() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
      <MedicationCard selected />
      <MedicationCard />
      <MedicationCard />
    </div>
  );
}
