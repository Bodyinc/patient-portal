export default function PageHeader() {
  return (
    <div className="mb-4 shrink-0 text-center">
      <h1 className="text-2xl font-semibold text-[#2E00AB]">Recommended Medications For You</h1>
      <p className="mx-auto mt-1 max-w-3xl text-base text-[#2E00AB]/80">
        Based on your initial health assessment, our clinical logic has identified several treatment
        options that may be suitable for your profile. These options are filtered based on your
        reported symptoms, medical history, and goals.
      </p>
    </div>
  );
}
