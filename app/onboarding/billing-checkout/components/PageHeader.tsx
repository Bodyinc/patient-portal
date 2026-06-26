import Image from "next/image";

export default function PageHeader() {
  return (
    <div className="mb-10">
      <Image src="/logo.svg" alt="Body Inc" width={170} height={60} priority />

      <h1 className="mt-10 text-center text-[32px] font-semibold text-[#2E00AB]">
        Billing & Checkout
      </h1>
    </div>
  );
}
