import Image from "next/image";

export default function PageHeader() {
  return (
    <>
      <Image src="/logo.png" alt="Body Inc" width={180} height={48} className="mb-14" />

      <div className="text-center">
        <h1 className="text-[32px] font-semibold text-[#2E00AB]">
          Recommended Medications For You
        </h1>

        <p className="mt-4 text-[20px] text-[#2E00AB]/80 max-w-[900px] mx-auto">
          Based on your initial health assessment, our clinical logic has identified several
          treatment options that may be suitable for your profile. Please review these
          recommendations carefully before selecting a path.
        </p>
      </div>
    </>
  );
}
