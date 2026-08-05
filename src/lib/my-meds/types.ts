export type MyMedsCurrentMedicationDto = {
  subscriptionId: string;
  medicineId: string | null;
  packageId: string | null;
  variantId: string | null;
  medicationName: string;
  currentPlan: string;
  quantitySupply: string;
  dosage: string;
  variantName: string | null;
  nextRefillDate: string | null;
  imageSrc: string;
};

export type MyMedsPastMedicationDto = {
  subscriptionId: string;
  medicineId: string | null;
  packageId: string | null;
  variantId: string | null;
  medicationName: string;
  currentPlan: string;
  variantName: string | null;
  dosage: string;
  imageSrc: string;
  endedAt: string | null;
  statusLabel: string;
};

export type MyMedsTimelineStepDto = {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
  at: string | null;
};

export type MyMedsMedicationRequestDto = {
  id: string;
  orderNumber: string;
  medicationName: string;
  planName: string | null;
  status: string;
  statusLabel: string;
  isRejected: boolean;
  requestDate: string;
  trackingNumber: string | null;
  pendingPaymentCents: number | null;
  prescription: {
    id: string;
    medicineName: string;
    directions: string | null;
    documentUrl: string | null;
  } | null;
  timeline: MyMedsTimelineStepDto[];
};

export type MyMedsMedicationRequestsListDto = {
  items: MyMedsMedicationRequestDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
};

export type MyMedsPageDataDto = {
  activeMedications: MyMedsCurrentMedicationDto[];
  pastMedications: MyMedsPastMedicationDto[];
  requests: MyMedsMedicationRequestsListDto;
};
