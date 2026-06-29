export type GoalId = "weight_loss" | "longevity" | "energy" | "muscle_recovery";
export type PlanMonths = "1" | "3";

export type Goal = {
  id: GoalId;
  label: string;
  description: string;
};

export type Medication = {
  id: string;
  name: string;
  tag: string;
  description: string;
  detailDescription: string;
  importantInfo: string[];
  notice: string;
  imageSrc?: string;
  priceMonthly: number;
  goalIds: GoalId[];
  requiresQuestionnaire: boolean;
  questionnaireId?: string;
};

const GLP1_IMPORTANT_INFO = [
  "Prescription required following clinical approval.",
  "Contact your provider if you experience unexpected side effects.",
  "Individual results may vary based on medical history and lifestyle.",
  "Use only as directed by your care team.",
];

const GLP1_NOTICE =
  "* Prescription required. Professional medical consultation necessary before fulfillment.";

const GLP1_DETAIL_DESCRIPTION =
  "GLP-1 Therapy helps regulate appetite, improve metabolic function, and support sustainable weight management. Your treatment plan is personalized based on your health assessment and clinician recommendations.";

export type QuestionOption = {
  id: string;
  label: string;
};

export type Question = {
  id: string;
  text: string;
  options: QuestionOption[];
};

export type Questionnaire = {
  id: string;
  title: string;
  questions: Question[];
};

export const GOALS: Goal[] = [
  {
    id: "weight_loss",
    label: "Weight Loss",
    description: "Lose weight sustainably with clinician-guided treatment.",
  },
  {
    id: "longevity",
    label: "Gain Longevity",
    description: "Support healthy aging and cellular wellness.",
  },
  {
    id: "energy",
    label: "Boost Energy",
    description: "Improve daily energy, focus, and metabolic health.",
  },
  {
    id: "muscle_recovery",
    label: "Muscle Recovery",
    description: "Enhance recovery, strength, and physical performance.",
  },
];

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export const SEX_OPTIONS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "other", label: "Other / Prefer not to say" },
] as const;

export const MEDICATIONS: Medication[] = [
  {
    id: "wegovy",
    name: "Wegovy®",
    tag: "GLP-1",
    description: "Personalized GLP-1 therapy for healthy weight loss and appetite control.",
    detailDescription: GLP1_DETAIL_DESCRIPTION,
    importantInfo: GLP1_IMPORTANT_INFO,
    notice: GLP1_NOTICE,
    imageSrc: "/syrup.svg",
    priceMonthly: 199,
    goalIds: ["weight_loss"],
    requiresQuestionnaire: true,
    questionnaireId: "glp1-screening",
  },
  {
    id: "ozempic",
    name: "Ozempic®",
    tag: "GLP-1",
    description: "Clinician-prescribed GLP-1 therapy for weight management and metabolic health.",
    detailDescription: GLP1_DETAIL_DESCRIPTION,
    importantInfo: GLP1_IMPORTANT_INFO,
    notice: GLP1_NOTICE,
    imageSrc: "/syrup.svg",
    priceMonthly: 189,
    goalIds: ["weight_loss", "energy"],
    requiresQuestionnaire: true,
    questionnaireId: "glp1-screening",
  },
  {
    id: "nad-plus",
    name: "NAD+ Therapy",
    tag: "Longevity",
    description: "Cellular wellness support to promote healthy aging, energy, and recovery.",
    detailDescription:
      "NAD+ therapy supports cellular energy production and healthy aging pathways. Your clinician will tailor dosing and monitoring based on your health profile and wellness goals.",
    importantInfo: [
      "Prescription required following clinical approval.",
      "Inform your provider of all supplements and medications you take.",
      "Individual response may vary based on health status and lifestyle.",
      "Follow your care team's guidance for safe use.",
    ],
    notice: GLP1_NOTICE,
    imageSrc: "/syrup.svg",
    priceMonthly: 149,
    goalIds: ["longevity", "energy"],
    requiresQuestionnaire: false,
  },
  {
    id: "bpc-157",
    name: "BPC-157",
    tag: "Recovery",
    description: "Peptide therapy focused on tissue repair, joint support, and recovery.",
    detailDescription:
      "BPC-157 is used to support tissue repair and recovery goals under clinical supervision. Your treatment plan is customized based on your activity level, injury history, and provider assessment.",
    importantInfo: [
      "Prescription required following clinical approval.",
      "Report any unusual symptoms to your provider promptly.",
      "Not a substitute for physical therapy or medical treatment when indicated.",
      "Use only as directed by your care team.",
    ],
    notice: GLP1_NOTICE,
    imageSrc: "/syrup.svg",
    priceMonthly: 129,
    goalIds: ["muscle_recovery", "longevity"],
    requiresQuestionnaire: false,
  },
];

export const QUESTIONNAIRES: Questionnaire[] = [
  {
    id: "glp1-screening",
    title: "GLP-1 Eligibility Screening",
    questions: [
      {
        id: "conditions",
        text: "Do you have any of the following conditions? (Select all that apply)",
        options: [
          { id: "type2-diabetes", label: "Type 2 diabetes" },
          { id: "high-bp", label: "High blood pressure" },
          { id: "heart-disease", label: "Heart disease" },
          { id: "thyroid", label: "Thyroid disorder" },
          { id: "none", label: "None of the above" },
        ],
      },
      {
        id: "medications",
        text: "Are you currently taking any of the following? (Select all that apply)",
        options: [
          { id: "insulin", label: "Insulin" },
          { id: "blood-thinners", label: "Blood thinners" },
          { id: "glp1", label: "Another GLP-1 medication" },
          { id: "none", label: "None of the above" },
        ],
      },
      {
        id: "symptoms",
        text: "Have you experienced any of these recently? (Select all that apply)",
        options: [
          { id: "nausea", label: "Persistent nausea" },
          { id: "pancreatitis", label: "History of pancreatitis" },
          { id: "gallbladder", label: "Gallbladder issues" },
          { id: "none", label: "None of the above" },
        ],
      },
    ],
  },
];

export function getGoalById(goalId: string | null) {
  return GOALS.find((g) => g.id === goalId) ?? null;
}

export function getMedicationById(medicationId: string | null) {
  return MEDICATIONS.find((m) => m.id === medicationId) ?? null;
}

export function getMedicationsForGoal(goalId: string | null) {
  if (!goalId) return [];
  return MEDICATIONS.filter((m) => m.goalIds.includes(goalId as GoalId));
}

export function getQuestionnaireForMedication(medicationId: string | null) {
  const medication = getMedicationById(medicationId);
  if (!medication?.questionnaireId) return null;
  return QUESTIONNAIRES.find((q) => q.id === medication.questionnaireId) ?? null;
}

export function medicationRequiresQuestionnaire(medicationId: string | null) {
  return getMedicationById(medicationId)?.requiresQuestionnaire ?? false;
}

export function getStateName(code: string | null) {
  if (!code) return "";
  return US_STATES.find((s) => s.code === code)?.name ?? code;
}

export const PLAN_PRICING = {
  "1": { listPrice: 197, salePrice: 177, label: "1 Month Plan" },
  "3": { listPrice: 197, salePrice: 167, label: "3 Month Plan", savings: 30 },
} as const;

export const CONSULTATION_FEE = 35;
export const PROCESSING_FEE = 5;
