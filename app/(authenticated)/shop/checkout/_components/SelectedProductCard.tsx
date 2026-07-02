import type { CheckoutProduct } from "./types";

export default function SelectedProductCard({ product }: { product: CheckoutProduct }) {
  return (
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#F3EEFF]">
          <img src={product.imageSrc} alt={product.name} className="h-10 w-auto object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-[#2E00AB]">{product.name}</p>
          <p className="truncate text-sm text-[#2E00AB]/75">{product.description}</p>
        </div>
      </div>
    </section>
  );
}
