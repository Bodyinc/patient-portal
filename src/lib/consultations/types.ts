export type ConsultationPlanState = {
  subscriptionId: string;
  medicineName: string;
  planLabel: string | null;
  imageSrc: string | null;
  startedAt: string | null;
  endedAt: string | null;
  visitStatus: "open" | "closed" | null;
  hasFormSubmission?: boolean;
  formSubmissionId?: string | null;
};

export type ConsultationsPageData = {
  configured: boolean;
  onboardingComplete: boolean;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  plans: ConsultationPlanState[];
};

export type QuickbloxSdkConfig = {
  appId: number;
  authKey: string;
  authSecret: string;
  accountKey: string;
  userId: number;
  email: string;
  password: string;
  token: string;
  dialogId: string | null;
  dialogJid?: string | null;
  providerId: number | null;
  providerName?: string | null;
  appointmentId: string;
  patientName: string;
  medicineName: string;
  intakeFormId: string;
};

export type IntakeAnswerItem = {
  label: string;
  value: string;
};

export type PatientConsultationData = {
  fullName: string;
  email: string;
  dob: string | null;
  age: number | null;
  sex: string | null;
  phone: string | null;
  stateCode: string | null;
  heightCm: number | null;
  weightKg: number | null;
  medicineName: string;
  planLabel: string | null;
  imageSrc: string | null;
  intakeSubmitted: boolean;
  intakeSubmittedAt: string | null;
  intakeSubmissionId: string | null;
  intakeAnswers: IntakeAnswerItem[];
};

export type StartConsultationResult =
  | {
      ok: true;
      embedUrl: string;
      alreadyStarted: boolean;
      isRoom?: boolean;
      appointmentId?: string;
      hasFormSubmission?: boolean;
      isFinished?: boolean;
      sdkConfig?: QuickbloxSdkConfig;
      patientData?: PatientConsultationData;
    }
  | { ok: false; message: string };
