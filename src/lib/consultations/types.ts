export type ConsultationPlanState = {
  subscriptionId: string;
  medicineName: string;
  planLabel: string | null;
  imageSrc: string | null;
  startedAt: string | null;
};

export type ConsultationsPageData = {
  configured: boolean;
  onboardingComplete: boolean;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  plans: ConsultationPlanState[];
};

export type StartConsultationResult =
  { ok: true; embedUrl: string; alreadyStarted: boolean } | { ok: false; message: string };
