import { preload } from "react-dom";

import { fetchActiveCategories } from "@/lib/intake/categories";
import { toResizedPublicImageSrc } from "@/lib/intake/medicine-image";

import GoalPageClient from "./_components/GoalPageClient";

export const revalidate = 300;

export default async function GoalPage() {
  const result = await fetchActiveCategories();
  const categories = result.ok ? result.data : [];

  for (const category of categories.slice(0, 4)) {
    if (!category.imageSrc) continue;
    preload(toResizedPublicImageSrc(category.imageSrc, { width: 406, quality: 70 }), {
      as: "image",
      fetchPriority: "high",
    });
  }

  return (
    <GoalPageClient
      initialCategories={categories}
      initialError={result.ok ? null : result.message}
    />
  );
}
