export type DashboardGoalDto = {
  id: string;
  name: string;
  imageSrc: string | null;
};

export type DashboardTreatmentDto = {
  medicineId: string | null;
  packageId: string | null;
  variantId: string | null;
  subscriptionId: string | null;
  name: string;
  currentPlan: string;
  variantDose: string;
  nextRefillDate: string | null;
  imageSrc: string | null;
  consultationStatus: "none" | "open" | "closed";
  /** Manual refill is open: order delivered, last week of the plan, and not auto-pay. */
  canRequestRefill: boolean;
  trackingNumber: string | null;
  consultationApproved: boolean;
};

export type DashboardPendingPaymentDto = {
  requestId: string;
  orderNumber: string;
  medicineName: string;
  amountCents: number;
  reason: string | null;
};

export type DashboardPageDataDto = {
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  bmi: number | null;
  bmiCategory: string;
  goals: DashboardGoalDto[];
  treatment: DashboardTreatmentDto | null;
  /** Number of active/trialing/past_due subscriptions for “view all” hint. */
  activeTreatmentCount: number;
  pendingPayments: DashboardPendingPaymentDto[];
  consultationsEnabled: boolean;
  /** This treatment's checkout includes a medicine that requires a consultation. */
  consultationRequired: boolean;
  /** A consultation visit already exists for this treatment, including after it is finished. */
  consultationVisit: boolean;
  /** The consultation intake form has been submitted for this treatment. */
  intakeSubmitted: boolean;
  /** Latest medication request was rejected or cancelled — hide intake CTA and that treatment. */
  latestOrderClosed: boolean;
};
