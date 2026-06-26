export default function FooterButtons() {
  return (
    <div className="flex justify-between items-center mt-12">
      <button className="border border-[#2E00AB]/40 rounded-md px-8 py-3 text-[#2E00AB]">
        ← Previous
      </button>

      <button className="rounded-md bg-[#2E00AB] px-8 py-3 text-white">Continue →</button>
    </div>
  );
}
