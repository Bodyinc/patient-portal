import Image from "next/image";

export default function OpenConsultationLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
      <Image src="/logo.svg" alt="BodyInc" width={120} height={36} priority />
      <p className="text-sm text-[#152A51]">Opening your consultation…</p>
    </main>
  );
}
