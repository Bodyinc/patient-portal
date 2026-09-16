"use client";

type MyMedsPromoBannerProps = {
  onAddNow?: () => void;
};

export default function MyMedsPromoBanner({ onAddNow }: MyMedsPromoBannerProps) {
  return (
    <section className="flex flex-col gap-3 rounded-[16px] bg-[#E8EEED] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
      <p className="text-sm font-medium leading-snug text-[#152A51] sm:text-[15px]">
        Save this code — Use code <span className="font-semibold">10OFF</span>
      </p>
      <button
        type="button"
        onClick={onAddNow}
        className="h-10 w-full shrink-0 rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-auto"
      >
        add now →
      </button>
    </section>
  );
}
