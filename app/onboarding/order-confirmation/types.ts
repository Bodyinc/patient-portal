export type ConfirmationData = {
  orderNumber: string;
  orderDate: string;
  medicineName: string | null;
  variantName: string | null;
  packageName: string | null;
  packagePrice: number | null;
  totalPaid: number | null;
  email: string | null;
  renewalShippingCents: number;
  passwordSet: boolean;
};
