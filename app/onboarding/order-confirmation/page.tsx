import Image from "next/image";

import ConfirmationHeader from "./components/ConfirmationHeader";
import OrderSummary from "./components/OrderSummary";
import ActionButtons from "./components/ActionButtons";

export default function OrderConfirmationPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />

      <div className="relative z-10 px-8 py-10">
        <Image src="/logo.svg" alt="Body Inc" width={150} height={50} />

        <div className="max-w-5xl mx-auto mt-20 space-y-14">
          <ConfirmationHeader />

          <OrderSummary />

          <ActionButtons />
        </div>
      </div>
    </main>
  );
}
