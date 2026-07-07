"use client";


import { usePathname } from "next/navigation";
import ConfirmationHeader from "../../../../onboarding/order-confirmation/components/ConfirmationHeader";
import OrderSummary from "../../../../onboarding/order-confirmation/components/OrderSummary";
import ActionButtons from "../../../../onboarding/order-confirmation/components/ActionButtons";

export default function ShopConfirmationPage() {
  return (
    
      <main className="flex h-screen flex-col overflow-hidden bg-[#F8F7FC]">
        {/* Search Header */}


        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto flex max-w-5xl justify-center">
            <div
              className="
                w-full
                rounded-3xl
                border
                border-[#DDD4FF]
                bg-white
                p-6
                shadow-sm
                lg:p-10
              "
            >
              {/* Header */}
              <ConfirmationHeader />

              {/* Order Summary */}
              <div className="mt-10">
                <OrderSummary />
              </div>

              {/* Buttons */}
              <div className="mt-10">
                <ActionButtons
                  dashboardHref="/dashboard"
                  treatmentHref="/shop"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    
  );
}