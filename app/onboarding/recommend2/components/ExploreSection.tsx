import { Button } from "@/components/ui/button";

export default function ExploreSection() {
  return (
    <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#2E00AB]/20 bg-white px-8 py-8">
      <div>
        <h3 className="text-[28px] font-semibold text-[#2E00AB]">Want To Explore Other Options?</h3>

        <p className="mt-2 text-[18px] text-[#2E00AB]/80">
          You can browse our full catalog, though these may require further assessment steps.
        </p>
      </div>

      <Button variant="outline" className="h-14 rounded-lg border-[#2E00AB]/30 text-[#2E00AB]">
        Browse all Medicines →
      </Button>
    </div>
  );
}
