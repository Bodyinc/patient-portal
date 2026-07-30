import Image from "next/image";

import { getDbMedicineImageSrc, isExternalMedicineImage } from "@/lib/intake/medicine-image";

import type { CheckoutProduct } from "./types";

export default function SelectedProductCard({ product }: { product: CheckoutProduct }) {
  const imageSrc = getDbMedicineImageSrc(product.imageSrc);
  const external = imageSrc ? isExternalMedicineImage(imageSrc) : false;

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-[#5D7293]">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="56px"
              unoptimized={external}
              className="object-cover object-top scale-[1.18]"
            />
          ) : null}
        </div>
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
