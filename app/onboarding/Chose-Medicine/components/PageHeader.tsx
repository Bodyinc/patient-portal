import Image from "next/image";

export default function PageHeader() {
  return (
    <>
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40 -z-10"
      />

      <Image
        src="/logo.svg"
        alt="Body Inc"
        width={170}
        height={45}
        className="absolute top-8 left-8"
      />

      <div className="text-center mt-28 mb-10">
        <h1 className="text-[32px] font-semibold text-[#2E00AB]">Select Your Medication</h1>

        <p className="mt-3 text-[20px] text-[#2E00AB]/80">
          Choose the treatment option that best aligns with your goals and clinician
          recommendations.
        </p>
      </div>
    </>
  );
}
