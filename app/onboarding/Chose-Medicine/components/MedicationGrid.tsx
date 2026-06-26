import MedicationCard from "./MedicationCard";

export default function MedicationGrid() {
  return (
    <div className="flex justify-center gap-8 mt-12">
      <MedicationCard selected />

      <MedicationCard />

      <MedicationCard />
    </div>
  );
}
