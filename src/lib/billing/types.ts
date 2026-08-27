export type BillingCancelSubscriptionDto = {
  id: string;
  medicineName: string;
  stripeSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  status: string;
};

export type BillingSubscriptionDto = {
  id: string;
  medicineId: string | null;
  packageId: string | null;
  variantId: string | null;
  medicineName: string;
  description: string;
  variantName: string | null;
  planLabel: string | null;
  imageSrc: string;
  nextBillingDate: string | null;
  upcomingCharge: number;
  status: string;
  cancelAtPeriodEnd: boolean;
  /** True when this medicine/subscription has an unpaid Workflow C additional payment. */
  hasPendingAdditionalPayment: boolean;
};

export type BillingPaymentDto = {
  id: string;
  orderNumber: string;
  date: string;
  description: string;
  subscriptionName: string;
  variantName: string | null;
  planLabel: string;
  amount: number;
  paymentMethod: string;
  status: string;
  stripeInvoiceId: string | null;
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
};

export type BillingPaymentsListDto = {
  items: BillingPaymentDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
};

export type BillingPageDataDto = {
  subscriptions: BillingSubscriptionDto[];
  payments: BillingPaymentsListDto;
};
