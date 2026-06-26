import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
export default function OrderSummary() {
  return (
    <Card className="rounded-3xl border border-[#2E00AB]/25 overflow-hidden shadow-none">
      <div className="bg-[#EDE7FA] px-6 py-4">
        <h2 className="text-2xl font-semibold text-[#2E00AB]">Order Summary</h2>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex justify-between">
          <span className="text-[#2E00AB]/80 text-base">Selected Medication</span>

          <span className="text-[#2E00AB] text-xl">GLP-1 Pathway Compound</span>
        </div>

        <Separator />

        <div className="flex justify-between">
          <span className="text-[#2E00AB]/80 text-base">Selected Plan</span>

          <span className="text-[#2E00AB] text-xl">3 Month Treatment Plan</span>
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <span className="text-[#2E00AB] text-xl font-medium">Total Paid</span>

          <span className="text-[42px] font-semibold text-[#2E00AB]">$167.00</span>
        </div>
      </div>
    </Card>
  );
}
