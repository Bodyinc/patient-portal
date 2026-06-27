import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function OrderSummary() {
  return (
    <Card className="overflow-hidden rounded-2xl border border-[#2E00AB]/25 shadow-none">
      <div className="bg-[#EDE7FA] px-5 py-3">
        <h2 className="text-lg font-semibold text-[#2E00AB]">Order Summary</h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex justify-between text-sm">
          <span className="text-[#2E00AB]/80">Selected Medication</span>
          <span className="text-base text-[#2E00AB]">GLP-1 Pathway Compound</span>
        </div>

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-[#2E00AB]/80">Selected Plan</span>
          <span className="text-base text-[#2E00AB]">3 Month Treatment Plan</span>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-[#2E00AB]">Total Paid</span>
          <span className="text-3xl font-semibold text-[#2E00AB]">$167.00</span>
        </div>
      </div>
    </Card>
  );
}
