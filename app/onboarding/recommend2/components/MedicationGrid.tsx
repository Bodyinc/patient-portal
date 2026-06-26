import MedicationCard from "../../Chose-Medicine/components/MedicationCard";

export default function MedicationGrid() {
  return (
    <div className="mt-6 grid grid-cols-3 gap-8">
      <MedicationCard selected />
      <MedicationCard />
      <MedicationCard />
    </div>
  );
}
