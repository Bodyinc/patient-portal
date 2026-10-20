import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import type { IntakeCartItemDto } from "./types";

export type CheckoutCartLine = IntakeCartItemDto & {
  stripePriceId: string | null;
  durationMonths: number | null;
};

type MedicineRow = {
  category_id: string;
  medicine_id: string;
  package_id: string | null;
  variant_id: string | null;
  is_primary: boolean;
  created_at: string;
};

export async function loadCheckoutCart(sessionId: string): Promise<CheckoutCartLine[]> {
  const { data, error } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("category_id, medicine_id, package_id, variant_id, is_primary, created_at")
    .eq("session_id", sessionId);

  if (error || !data?.length) return [];

  const rows = data as MedicineRow[];
  const categoryIds = [...new Set(rows.map((row) => row.category_id))];
  const medicineIds = [...new Set(rows.map((row) => row.medicine_id))];
  const packageIds = [
    ...new Set(rows.map((row) => row.package_id).filter((id): id is string => Boolean(id))),
  ];
  const variantIds = [
    ...new Set(rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id))),
  ];

  const [categories, medicines, packages, variants] = await Promise.all([
    supabaseAdmin.from("medication_categories").select("id, slug, name").in("id", categoryIds),
    supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds),
    packageIds.length
      ? supabaseAdmin
          .from("packages")
          .select(
            "id, name, price, original_price, stripe_price_id, duration_months, variant_id, medicine_variants(name)",
          )
          .in("id", packageIds)
      : Promise.resolve({ data: [] as never[] }),
    variantIds.length
      ? supabaseAdmin.from("medicine_variants").select("id, name").in("id", variantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const categoryById = new Map((categories.data ?? []).map((row) => [row.id, row]));
  const medicineById = new Map((medicines.data ?? []).map((row) => [row.id, row]));
  const packageById = new Map(
    (packages.data ?? []).map((row) => {
      const pkg = row as {
        id: string;
        name: string;
        price: number;
        original_price: number;
        stripe_price_id: string | null;
        duration_months: number;
        variant_id: string | null;
        medicine_variants?: { name: string } | null;
      };
      return [pkg.id, pkg];
    }),
  );
  const variantById = new Map((variants.data ?? []).map((row) => [row.id, row.name]));

  return rows
    .map((row) => {
      const category = categoryById.get(row.category_id);
      const medicine = medicineById.get(row.medicine_id);
      const pkg = row.package_id ? packageById.get(row.package_id) : undefined;
      const variantName =
        (row.variant_id ? variantById.get(row.variant_id) : null) ??
        pkg?.medicine_variants?.name ??
        null;
      return {
        categoryId: row.category_id,
        categorySlug: category?.slug ?? "",
        categoryName: category?.name ?? "Treatment",
        medicineId: row.medicine_id,
        medicineName: medicine?.name ?? "Medication",
        variantId: row.variant_id ?? pkg?.variant_id ?? null,
        variantName,
        packageId: row.package_id,
        packageName: pkg?.name ?? null,
        packagePrice: pkg ? Number(pkg.price) : null,
        packageOriginalPrice: pkg ? Number(pkg.original_price) : null,
        isPrimary: row.is_primary,
        stripePriceId: pkg?.stripe_price_id ?? null,
        durationMonths: pkg?.duration_months ?? null,
        createdAt: row.created_at,
      };
    })
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map(({ createdAt: _createdAt, ...line }) => line);
}
