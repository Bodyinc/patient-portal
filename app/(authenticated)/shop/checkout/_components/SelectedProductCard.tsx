import type { CheckoutProduct } from "./types";

export default function SelectedProductCard({ product }: { product: CheckoutProduct }) {
  return (
    <section className="rounded-2xl border border-[#E6DEFF] bg-white p-5">
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#F3EEFF]">
          <img 
            src={product.imageSrc} 
            alt={product.name} 
            className="h-12 w-auto object-contain" 
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-[#2E00AB] leading-tight">{product.name}</p>
          <p className="text-sm text-[#2E00AB]/70 mt-1 line-clamp-2">{product.description}</p>
        </div>
      </div>
    </section>
  );
}