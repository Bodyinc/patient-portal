import { getDbMedicineImageSrc } from "@/lib/intake/medicine-image";

import MedicineProductImage from "../../../../onboarding/_components/MedicineProductImage";

import type { CheckoutProduct } from "./types";

export default function SelectedProductCard({ product }: { product: CheckoutProduct }) {
  const imageSrc = getDbMedicineImageSrc(product.imageSrc);

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white ">
      <div className="flex items-center gap-3 sm:gap-4">
        <MedicineProductImage
          src={imageSrc}
          alt={product.name}
          squareSize={80}
          frameClassName="rounded-[14px] bg-[#E8EEED]"
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[20px]">
            {product.name}
          </p>
          <p className="truncate text-sm text-[#152A51]/75">{product.description}</p>
        </div>
      </div>
    </section>
  );
}
