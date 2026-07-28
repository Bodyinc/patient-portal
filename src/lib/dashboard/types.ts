export type DashboardGoalDto = {
  id: string;
  name: string;
  icon: string | null;
};

export type DashboardTreatmentDto = {
  medicineId: string;
  name: string;
  description: string | null;
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
};
