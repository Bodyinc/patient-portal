export default function ConfirmationHeader() {
  return (
    <div className="text-center space-y-5">
      <h1 className="text-[32px] font-semibold text-[#2E00AB]">Order Confirmed</h1>

      <p className="text-[20px] font-normal text-[#2E00AB]/80 max-w-4xl mx-auto leading-tight">
        Thank you for choosing Body Inc. Your order has been successfully received and is now being
        reviewed by our clinical team. You'll receive updates via email as your treatment
        progresses.
      </p>

      <div className="flex justify-center gap-3">
        <div className="border border-[#2E00AB]/25 rounded-md px-5 py-2 text-[#2E00AB] text-sm font-medium">
          Order Number: #12345678
        </div>

        <div className="border border-[#2E00AB]/25 rounded-md px-5 py-2 text-[#2E00AB] text-sm font-medium">
          Order Date: June 19, 2024
        </div>
      </div>
    </div>
  );
}
