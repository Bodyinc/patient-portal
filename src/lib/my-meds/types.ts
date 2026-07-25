export type MyMedsCurrentMedicationDto = {
  subscriptionId: string;
  medicineId: string | null;
  medicationName: string;
  currentPlan: string;
  quantitySupply: string;
  dosage: string;
  nextRefillDate: string | null;
  imageSrc: string;
};

export type MyMedsTimelineStepDto = {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
  at: string | null;
};

export type MyMedsMedicationRequestDto = {
  id: string;
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
  currentMedication: MyMedsCurrentMedicationDto | null;
  requests: MyMedsMedicationRequestsListDto;
};
