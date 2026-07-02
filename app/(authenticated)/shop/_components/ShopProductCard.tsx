import type { ShopMedicineCardDto } from "@/lib/shop/types";

export default function ShopProductCard({ item }: { item: ShopMedicineCardDto }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#DCD2FF] bg-white">
      <div className="relative flex min-h-[180px] items-center justify-center bg-[#F3EEFF] p-4">
        <img
          src="/curve-line.svg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <img
          src={item.imageSrc}
          alt={item.name}
          className="relative z-10 h-28 w-auto object-contain"
        />
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-3 font-semibold text-[#2E00AB] sm:text-xl">{item.name}</h3>
          <span className="rounded-md border border-[#2E00AB]/20 bg-[#F8F4FF] px-2 py-0.5 text-[11px] text-[#2E00AB]">
            {item.categoryName}
          </span>
        </div>
        <p className="line-clamp-3 min-h-[60px] text-sm text-[#2E00AB]/80">{item.description}</p>
        <p className="text-3xl font-semibold leading-none text-[#2E00AB]">
          ${item.priceMonthly}/mo
        </p>
        <button
          type="button"
          className="w-full rounded-md border border-[#2E00AB]/30 bg-white py-2 text-sm font-medium text-[#2E00AB] transition hover:bg-[#F8F4FF]"
        >
          View Details
        </button>
      </div>
    </article>
  );
}
