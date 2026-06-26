import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function ActionButtons() {
  return (
    <div className="flex justify-center gap-4">
      <Button className="bg-[#2E00AB] hover:bg-[#24008a] rounded-md h-12 px-8">
        Go to Dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <Button variant="outline" className="border-[#2E00AB]/40 text-[#2E00AB] rounded-md h-12 px-8">
        View Treatment Details
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
