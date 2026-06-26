export default function RecommendationBanner() {
  return (
    <div className="mt-12 rounded-2xl border border-[#2E00AB]/20 bg-white p-8 text-center">
      <h2 className="text-2xl font-semibold text-[#2E00AB]">Personalized Recommendations</h2>

      <p className="mt-3 text-[18px] text-[#2E00AB]/80 max-w-3xl mx-auto">
        These options are filtered based on your reported symptoms, medical history, and goals.
        Final approval remains subject to review by a certified clinician during your
        tele-consultation.
      </p>
    </div>
  );
}
