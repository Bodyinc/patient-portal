import { Button } from "@/components/ui/button";

export default function FooterButtons() {
  return (
    <div className="mt-10 flex justify-between">
      <Button variant="outline" className="border-[#2E00AB]/40 text-[#2E00AB]">
        ← Previous
      </Button>

      <Button className="bg-[#2E00AB] hover:bg-[#25008f]">Continue →</Button>
    </div>
  );
}
