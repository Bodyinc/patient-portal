export type DashboardGoalDto = {
  id: string;
  name: string;
  imageSrc: string | null;
};

export type DashboardTreatmentDto = {
  medicineId: string | null;
  packageId: string | null;
  variantId: string | null;
  name: string;
  currentPlan: string;
  variantDose: string;
  nextRefillDate: string | null;
  imageSrc: string | null;
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
};
