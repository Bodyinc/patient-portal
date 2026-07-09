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

export type MyMedsMedicationRequestDto = {
  id: string;
  medicationName: string;
  dosage: string;
  supplyDuration: string;
  requestDate: string;
  status: string;
  trackingNumber: string | null;
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
