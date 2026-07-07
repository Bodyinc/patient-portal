export default function ConfirmationHeader() {
  return (
    <div className="space-y-3 text-center">
      <h1 className="text-2xl font-semibold text-[#2E00AB]">Order Confirmed</h1>

      <p className="mx-auto max-w-2xl text-base text-[#2E00AB]/80">
        Thank you for choosing BodyInc. Your order has been successfully received and is now being
        reviewed by our clinical team. You&apos;ll receive updates via email as your treatment
        progresses.
      </p>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="rounded-md border border-[#2E00AB]/25 px-4 py-1.5 text-sm font-medium text-[#2E00AB]">
          Order Number: #12345678
        </div>
        <div className="rounded-md border border-[#2E00AB]/25 px-4 py-1.5 text-sm font-medium text-[#2E00AB]">
          Order Date: June 19, 2024
        </div>
      </div>
    </div>
  );
}
