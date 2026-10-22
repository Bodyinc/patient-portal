export type ConfirmationData = {
  orderNumber: string;
  orderDate: string;
  medicineName: string | null;
  variantName: string | null;
  packageName: string | null;
  packagePrice: number | null;
  packageOriginalPrice: number | null;
  totalPaid: number | null;
  email: string | null;
  consultationFeeCents: number;
  renewalShippingCents: number;
  passwordSet: boolean;
  items: Array<{ name: string; planLabel: string; price: number | null }>;
};
