type ConfirmationHeaderProps = {
  orderNumber?: string;
  orderDate?: string;
};

export default function ConfirmationHeader({
  orderNumber = "12345678",
  orderDate = "June 19, 2024",
}: ConfirmationHeaderProps) {
  return (
    <div className="space-y-3 text-center">
      <h1 className="text-2xl font-semibold text-[#2E00AB]">
        Order Confirmed
      </h1>

      <p className="mx-auto max-w-2xl text-base text-[#2E00AB]/80">
        Thank you for choosing Body Inc. Your order has been successfully
        received and is now being reviewed by our clinical team. You'll receive
        updates via email as your treatment progresses.
      </p>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="rounded-md border border-[#2E00AB]/25 px-4 py-1.5 text-sm font-medium text-[#2E00AB]">
          Order Number: #{orderNumber}
        </div>

        <div className="rounded-md border border-[#2E00AB]/25 px-4 py-1.5 text-sm font-medium text-[#2E00AB]">
          Order Date: {orderDate}
        </div>
      </div>
    </div>
  );
}