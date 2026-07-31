import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { formatOrderId } from "@/lib/orders/order-id";
import {
  fromPriceDollars,
  planSubtitleFromDuration,
  planTitleFromDuration,
  priceLabelFromDuration,
} from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ShopCategoryDto,
  ShopMedicineVariantOption,
  ShopMedicinesListDto,
  ShopSortOption,
} from "./types";
import type {
  ShopCheckoutBootstrapDto,
  ShopCheckoutOrderCreateInput,
  ShopCheckoutOrderDto,
} from "./service-types";

export async function fetchShopCategoriesData(): Promise<ShopCategoryDto[]> {
  const { data, error } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
  }));
}

export async function fetchShopCatalogData(options: {
  categorySlug?: string | null;
  sortBy?: ShopSortOption;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}): Promise<ShopMedicinesListDto> {
  const categorySlug = options.categorySlug ?? null;
  const sortBy = options.sortBy ?? "popular";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(24, options.pageSize ?? 6));
  const searchQuery = (options.searchQuery ?? "").trim();

  let filteredMedicineIds: string[] | null = null;
  let selectedCategoryName: string | null = null;

  if (categorySlug) {
    const { data: category, error: categoryError } = await supabaseAdmin
      .from("medication_categories")
      .select("id, name")
      .eq("slug", categorySlug)
      .eq("is_active", true)
      .maybeSingle();

    if (categoryError || !category) {
      throw new Error("Category not found.");
    }

    selectedCategoryName = category.name;

    const { data: links, error: linksError } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("medicine_id")
      .eq("category_id", category.id);

    if (linksError) throw new Error(linksError.message);

    filteredMedicineIds = [...new Set((links ?? []).map((link) => link.medicine_id))];
    if (filteredMedicineIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        sortBy,
        currentCategorySlug: categorySlug,
        searchQuery,
      };
    }
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabaseAdmin
    .from("medicines")
    .select("id, name, short_description, image_url, from_price_cents, sort_order", {
      count: "exact",
    })
    .eq("is_active", true)
    .eq("status", "active");

  if (filteredMedicineIds) query = query.in("id", filteredMedicineIds);
  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,short_description.ilike.%${searchQuery}%`);
  }

  if (sortBy === "price_asc")
    query = query.order("from_price_cents", { ascending: true, nullsFirst: false });
  if (sortBy === "price_desc")
    query = query.order("from_price_cents", { ascending: false, nullsFirst: false });
  if (sortBy === "name_asc") query = query.order("name", { ascending: true });
  if (sortBy === "popular") query = query.order("sort_order", { ascending: true });
  query = query.order("id", { ascending: true });

  const { data: medicines, error, count } = await query.range(start, end);
  if (error) throw new Error(error.message);

  const validMeds = medicines ?? [];
  const medicineIds = validMeds.map((medicine) => medicine.id);
  let categoryNameByMedicineId = new Map<string, string>();

  if (!selectedCategoryName && medicineIds.length > 0) {
    const { data: links } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("medicine_id, category_id")
      .in("medicine_id", medicineIds);

    const categoryIds = [...new Set((links ?? []).map((link) => link.category_id))];
    if (categoryIds.length > 0) {
      const { data: categories } = await supabaseAdmin
        .from("medication_categories")
        .select("id, name")
        .in("id", categoryIds);

      const categoryMap = new Map(
        (categories ?? []).map((category) => [category.id, category.name]),
      );
      categoryNameByMedicineId = new Map(
        (links ?? [])
          .filter((link) => categoryMap.has(link.category_id))
          .map((link) => [link.medicine_id, categoryMap.get(link.category_id)!]),
      );
    }
  }

  const variantsByMedicineId = new Map<string, ShopMedicineVariantOption[]>();
  if (medicineIds.length > 0) {
    const { data: variantRows } = await supabaseAdmin
      .from("medicine_variants")
      .select("id, medicine_id, name, from_price_cents")
      .in("medicine_id", medicineIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    for (const v of variantRows ?? []) {
      const list = variantsByMedicineId.get(v.medicine_id) ?? [];
      list.push({
        id: v.id,
        name: v.name,
        fromPriceCents: v.from_price_cents == null ? null : Number(v.from_price_cents),
      });
      variantsByMedicineId.set(v.medicine_id, list);
    }
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: validMeds.map((medicine) => ({
      id: medicine.id,
      name: medicine.name,
      categoryName: selectedCategoryName ?? categoryNameByMedicineId.get(medicine.id) ?? "Wellness",
      description: medicine.short_description,
      imageSrc: resolveMedicineImageSrc(medicine.image_url),
      fromPriceCents: medicine.from_price_cents == null ? null : Number(medicine.from_price_cents),
      variants: variantsByMedicineId.get(medicine.id) ?? [],
    })),
    total,
    page,
    pageSize,
    totalPages,
    sortBy,
    currentCategorySlug: categorySlug,
    searchQuery,
  };
}

export async function fetchShopCheckoutBootstrapData(options: {
  medicineId: string;
  variantId?: string | null;
}): Promise<ShopCheckoutBootstrapDto> {
  const { medicineId, variantId } = options;

  const { data: medicine, error: medicineError } = await supabaseAdmin
    .from("medicines")
    .select("id, name, short_description, image_url, from_price_cents")
    .eq("id", medicineId)
    .eq("is_active", true)
    .eq("status", "active")
    .maybeSingle();

  if (medicineError || !medicine) throw new Error("Medicine not found.");

  // When a variant is chosen, pricing comes from that variant's packages; otherwise from the
  // medicine's own (variant-less) packages.
  let variant: { id: string; name: string; from_price_cents: number | null } | null = null;
  if (variantId) {
    const { data: variantRow } = await supabaseAdmin
      .from("medicine_variants")
      .select("id, name, from_price_cents, is_active, medicine_id")
      .eq("id", variantId)
      .maybeSingle();
    if (!variantRow || variantRow.medicine_id !== medicine.id || variantRow.is_active !== true) {
      throw new Error("Selected variant is not available.");
    }
    variant = {
      id: variantRow.id,
      name: variantRow.name,
      from_price_cents: variantRow.from_price_cents,
    };
  }

  // Unpriced packages are not chargeable — leaving them out means the "Pricing coming soon"
  // path below catches them, instead of the patient failing at the payment step.
  let packagesQuery = supabaseAdmin
    .from("packages")
    .select("id, name, duration_months, price, is_most_popular, is_active")
    .eq("medicine_id", medicine.id)
    .eq("is_active", true)
    .not("stripe_price_id", "is", null)
    .order("sort_order", { ascending: true });
  packagesQuery = variant
    ? packagesQuery.eq("variant_id", variant.id)
    : packagesQuery.is("variant_id", null);

  const [{ data: categoryLinks }, { data: packages, error: packagesError }] = await Promise.all([
    supabaseAdmin
      .from("medication_category_medicines")
      .select("category_id")
      .eq("medicine_id", medicine.id)
      .limit(1),
    packagesQuery,
  ]);

  if (packagesError) throw new Error(packagesError.message);

  // No active package means this is "Pricing coming soon" — not purchasable.
  if (!packages || packages.length === 0) {
    throw new Error(
      variant
        ? "Pricing for this option is coming soon — checkout isn't available yet."
        : "Pricing for this medicine is coming soon — checkout isn't available yet.",
    );
  }

  let categoryName = "Wellness";
  const categoryId = categoryLinks?.[0]?.category_id;
  if (categoryId) {
    const { data: category } = await supabaseAdmin
      .from("medication_categories")
      .select("name")
      .eq("id", categoryId)
      .maybeSingle();
    if (category?.name) categoryName = category.name;
  }

  const plans = packages.map((pkg) => ({
    id: pkg.id,
    title: planTitleFromDuration(pkg.duration_months),
    subtitle: planSubtitleFromDuration(pkg.duration_months),
    priceLabel: priceLabelFromDuration(Number(pkg.price), pkg.duration_months),
    amount: Number(pkg.price),
    durationMonths: pkg.duration_months,
    badge: pkg.is_most_popular ? "Most Popular" : undefined,
  }));
  const baseMonthly = fromPriceDollars(
    variant ? variant.from_price_cents : medicine.from_price_cents,
  );

  // Default to the highlighted plan, else the first available one; keyed by plan id so any
  // set of durations selects cleanly.
  const defaultPlan = plans.find((p) => p.badge) ?? plans[0];

  return {
    product: {
      id: medicine.id,
      name: variant ? `${medicine.name} — ${variant.name}` : medicine.name,
      category: categoryName,
      description: medicine.short_description,
      imageSrc: resolveMedicineImageSrc(medicine.image_url),
      baseMonthlyPrice: baseMonthly,
    },
    plans,
    paymentMethods: [
      { id: "card", title: "Visa •••• 4242", subtitle: "Expires 12/26" },
      { id: "alt", title: "Alternative Payment", subtitle: "Apple Pay / PayPal" },
      { id: "new", title: "Add Payment Method", subtitle: "" },
    ],
    referralHint: "Invite a friend and you'll both receive a $50 account credit.",
    defaultSelectedPlan: defaultPlan?.id ?? "",
  };
}

export async function createShopCheckoutOrderData(options: {
  userId: string;
  input: ShopCheckoutOrderCreateInput;
}): Promise<ShopCheckoutOrderDto> {
  const { userId, input } = options;

  const { data: medicine } = await supabaseAdmin
    .from("medicines")
    .select("id, name, short_description, image_url")
    .eq("id", input.medicineId)
    .maybeSingle();

  if (!medicine) throw new Error("Medicine not found.");

  const { data: selectedPackage } = input.packageId
    ? await supabaseAdmin
        .from("packages")
        .select("name, duration_months, medicine_variants(name)")
        .eq("id", input.packageId)
        .maybeSingle()
    : { data: null };
  const selectedPlanLabel =
    selectedPackage?.name?.trim() || planTitleFromDuration(selectedPackage?.duration_months);
  const variantName =
    (selectedPackage as { medicine_variants?: { name: string } | null } | null)?.medicine_variants
      ?.name ?? null;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("shop_checkout_orders")
    .insert({
      user_id: userId,
      medicine_id: input.medicineId,
      selected_package_id: input.packageId,
      selected_plan_code: input.selectedPlanCode,
      payment_method_code: input.paymentMethodCode,
      promo_code: input.promoCode,
      promo_savings: input.promoSavings,
      subtotal: input.subtotal,
      shipping: input.shipping,
      total: input.total,
      status: "pending_payment",
    })
    .select("*")
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? "Unable to create order.");

  const { error: itemError } = await supabaseAdmin.from("shop_checkout_order_items").insert({
    order_id: order.id,
    medicine_id: input.medicineId,
    package_id: input.packageId,
    name: medicine.name,
    description: medicine.short_description,
    image_url: medicine.image_url,
    quantity: 1,
    unit_price: input.subtotal,
    line_total: input.total,
  });

  if (itemError) throw new Error(itemError.message);

  await supabaseAdmin.from("shop_checkout_events").insert({
    order_id: order.id,
    event_type: "order_created",
    payload: {
      selectedPlanCode: input.selectedPlanCode,
      paymentMethodCode: input.paymentMethodCode,
    },
  });

  return {
    id: order.id,
    orderNumber: formatOrderId(order.id),
    status: order.status,
    createdAt: order.created_at,
    productName: medicine.name,
    variantName,
    selectedPlanLabel,
    subtotal: Number(order.subtotal),
    promoSavings: Number(order.promo_savings),
    shipping: Number(order.shipping),
    consultation: Number(order.consultation ?? 0),
    total: Number(order.total),
    walletApplied: null,
    totalPaid: null,
    discounts: null,
  };
}

export async function getShopCheckoutOrderByIdData(options: {
  userId: string;
  orderId: string;
}): Promise<ShopCheckoutOrderDto> {
  const { userId, orderId } = options;
  const { data: order, error } = await supabaseAdmin
    .from("shop_checkout_orders")
    .select(
      "id, status, created_at, selected_plan_code, selected_package_id, subtotal, promo_savings, shipping, consultation, total, medicine_id, stripe_invoice_id",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !order) throw new Error("Order not found.");

  const [{ data: medicine }, { data: selectedPackage }] = await Promise.all([
    supabaseAdmin.from("medicines").select("name").eq("id", order.medicine_id).maybeSingle(),
    order.selected_package_id
      ? supabaseAdmin
          .from("packages")
          .select("name, duration_months, medicine_variants(name)")
          .eq("id", order.selected_package_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const selectedPlanLabel =
    selectedPackage?.name?.trim() || planTitleFromDuration(selectedPackage?.duration_months);
  const variantName =
    (selectedPackage as { medicine_variants?: { name: string } | null } | null)?.medicine_variants
      ?.name ?? null;

  // Once paid, the Stripe invoice is the truth for what was charged and how much
  // wallet credit Stripe consumed — the stored order totals are pre-payment estimates.
  let walletApplied: number | null = null;
  let totalPaid: number | null = null;
  let discounts: Array<{ label: string; amount: number }> | null = null;
  if (order.stripe_invoice_id) {
    const { data: pay } = await supabaseAdmin
      .from("payments")
      .select("amount_cents, raw_event")
      .eq("stripe_invoice_id", order.stripe_invoice_id)
      .maybeSingle();
    if (pay) {
      totalPaid = Number(pay.amount_cents) / 100;
      const invoice = pay.raw_event as {
        lines?: { data?: Array<{ amount?: number | null; description?: string | null }> };
        starting_balance?: number | null;
        ending_balance?: number | null;
      } | null;
      const used = ((invoice?.ending_balance ?? 0) - (invoice?.starting_balance ?? 0)) / 100;
      walletApplied = used > 0 ? used : 0;
      discounts = (invoice?.lines?.data ?? [])
        .filter((l) => (l.amount ?? 0) < 0)
        .map((l) => ({
          label: l.description ?? "Discount",
          amount: Math.abs(l.amount ?? 0) / 100,
        }));
    }
  }

  return {
    id: order.id,
    orderNumber: formatOrderId(order.id),
    status: order.status,
    createdAt: order.created_at,
    productName: medicine?.name ?? "Product",
    variantName,
    selectedPlanLabel,
    subtotal: Number(order.subtotal),
    promoSavings: Number(order.promo_savings),
    shipping: Number(order.shipping),
    consultation: Number(order.consultation),
    total: Number(order.total),
    walletApplied,
    totalPaid,
    discounts,
  };
}
