import { Button } from "@/components/ui/button";

export default function ExploreSection() {
  return (
    <div className="mt-3 flex shrink-0 flex-col gap-3 rounded-xl border border-[#2E00AB]/20 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
      <div>
        <h3 className="text-base font-semibold text-[#2E00AB] sm:text-lg">
          Want To Explore Other Options?
        </h3>
        <p className="text-sm text-[#2E00AB]/80">
          Browse our full catalog — some options may require further assessment.
        </p>
      </div>

      <Button
        variant="outline"
        className="h-10 w-full rounded-lg border-[#2E00AB]/30 text-[#2E00AB] sm:w-auto sm:shrink-0"
      >
        Browse All Medications →
      </Button>
    </div>
  );
}
