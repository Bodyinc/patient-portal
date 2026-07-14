import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ShopCategoryDto, ShopMedicinesListDto, ShopSortOption } from "./types";
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
    .select("id, name, short_description, image_url, price_monthly, sort_order", {
      count: "exact",
    })
    .eq("is_active", true)
    .eq("status", "active");

  if (filteredMedicineIds) query = query.in("id", filteredMedicineIds);
  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,short_description.ilike.%${searchQuery}%`);
  }

  if (sortBy === "price_asc") query = query.order("price_monthly", { ascending: true });
  if (sortBy === "price_desc") query = query.order("price_monthly", { ascending: false });
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

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: validMeds.map((medicine) => ({
      id: medicine.id,
      name: medicine.name,
      categoryName: selectedCategoryName ?? categoryNameByMedicineId.get(medicine.id) ?? "Wellness",
      description: medicine.short_description,
      imageSrc: resolveMedicineImageSrc(medicine.image_url),
      priceMonthly: Number(medicine.price_monthly),
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

function formatMoneyLabel(amount: number, durationMonths: number) {
  if (durationMonths === 1) return `$${amount}/month`;
  if (durationMonths === 3) return `$${amount}/quarter`;
  return `$${amount}/${durationMonths} months`;
}

export async function fetchShopCheckoutBootstrapData(options: {
  medicineId: string;
}): Promise<ShopCheckoutBootstrapDto> {
  const { medicineId } = options;

  const { data: medicine, error: medicineError } = await supabaseAdmin
    .from("medicines")
    .select("id, name, short_description, image_url, price_monthly")
    .eq("id", medicineId)
    .eq("is_active", true)
    .eq("status", "active")
    .maybeSingle();

  if (medicineError || !medicine) throw new Error("Medicine not found.");

  const [{ data: categoryLinks }, { data: packages, error: packagesError }] = await Promise.all([
    supabaseAdmin
      .from("medication_category_medicines")
      .select("category_id")
      .eq("medicine_id", medicine.id)
      .limit(1),
    supabaseAdmin
      .from("packages")
      .select("id, name, duration_months, price, is_most_popular, is_active")
      .eq("medicine_id", medicine.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (packagesError) throw new Error(packagesError.message);

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

  const plans = (packages ?? []).map((pkg) => ({
    id: pkg.id,
    code: pkg.duration_months === 1 ? ("monthly" as const) : ("quarterly" as const),
    title: pkg.duration_months === 1 ? "Monthly Plan" : `${pkg.duration_months}-Month Plan`,
    subtitle:
      pkg.duration_months === 1
        ? "Billed every 30 days. Cancel anytime."
        : `Billed every ${pkg.duration_months * 30} days with free shipping.`,
    priceLabel: formatMoneyLabel(Number(pkg.price), pkg.duration_months),
    amount: Number(pkg.price),
    badge: pkg.is_most_popular ? "Most Popular" : undefined,
  }));
  const fallbackPlans =
    plans.length > 0
      ? plans
      : [
          {
            id: `${medicine.id}-monthly`,
            code: "monthly" as const,
            title: "Monthly Plan",
            subtitle: "Billed every 30 days. Cancel anytime.",
            priceLabel: formatMoneyLabel(Number(medicine.price_monthly), 1),
            amount: Number(medicine.price_monthly),
          },
          {
            id: `${medicine.id}-quarterly`,
            code: "quarterly" as const,
            title: "3-Month Plan",
            subtitle: "Billed every 90 days with free shipping.",
            priceLabel: formatMoneyLabel(Number(medicine.price_monthly) * 3, 3),
            amount: Number(medicine.price_monthly) * 3,
            badge: "Most Popular",
          },
        ];

  return {
    product: {
      id: medicine.id,
      name: medicine.name,
      category: categoryName,
      description: medicine.short_description,
      imageSrc: resolveMedicineImageSrc(medicine.image_url),
      baseMonthlyPrice: Number(medicine.price_monthly),
    },
    plans: fallbackPlans,
    paymentMethods: [
      { id: "card", title: "Visa •••• 4242", subtitle: "Expires 12/26" },
      { id: "alt", title: "Alternative Payment", subtitle: "Apple Pay / PayPal" },
      { id: "new", title: "Add Payment Method", subtitle: "" },
    ],
    referralHint: "Invite a friend and you'll both receive a $50 account credit.",
    defaultSelectedPlan: "quarterly",
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
    status: order.status,
    createdAt: order.created_at,
    productName: medicine.name,
    selectedPlanLabel: input.selectedPlanCode === "monthly" ? "Monthly Plan" : "3-Month Plan",
    subtotal: Number(order.subtotal),
    promoSavings: Number(order.promo_savings),
    shipping: Number(order.shipping),
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
      "id, status, created_at, selected_plan_code, subtotal, promo_savings, shipping, total, medicine_id, stripe_invoice_id",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !order) throw new Error("Order not found.");

  const { data: medicine } = await supabaseAdmin
    .from("medicines")
    .select("name")
    .eq("id", order.medicine_id)
    .maybeSingle();

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
    status: order.status,
    createdAt: order.created_at,
    productName: medicine?.name ?? "Product",
    selectedPlanLabel: order.selected_plan_code === "monthly" ? "Monthly Plan" : "3-Month Plan",
    subtotal: Number(order.subtotal),
    promoSavings: Number(order.promo_savings),
    shipping: Number(order.shipping),
    total: Number(order.total),
    walletApplied,
    totalPaid,
    discounts,
  };
}
