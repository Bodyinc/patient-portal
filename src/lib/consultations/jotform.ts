import "server-only";

import type { IntakeAnswerAttachment, IntakeAnswerItem } from "./types";

const DEFAULT_JOTFORM_API_KEY = "983f5108959b618eea6284964e342464";
const DEFAULT_JOTFORM_INTAKE_FORM_ID = "253156067633054";
const JOTFORM_API_BASE = "https://hipaa-api.jotform.com";
const DEFAULT_JOTFORM_FORM_BASE = "https://hipaa.jotform.com";

export type JotformSubmissionResult = {
  submitted: boolean;
  submissionId: string | null;
  submittedAt: string | null;
};

export function getJotformConfig() {
  const apiKey = (process.env.JOTFORM_API_KEY || DEFAULT_JOTFORM_API_KEY).trim();
  const intakeFormId = (
    process.env.JOTFORM_INTAKE_FORM_ID || DEFAULT_JOTFORM_INTAKE_FORM_ID
  ).trim();
  const formBase = (process.env.JOTFORM_FORM_BASE || DEFAULT_JOTFORM_FORM_BASE)
    .trim()
    .replace(/\/+$/, "");
  return { apiKey, intakeFormId, apiBase: JOTFORM_API_BASE, formBase };
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(?:\?|#|$)/i;

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "Attachment";
  } catch {
    return "Attachment";
  }
}

function attachmentKind(url: string, name?: string): "image" | "file" {
  const probe = `${name ?? ""} ${url}`;
  return IMAGE_EXT_RE.test(probe) ? "image" : "file";
}

/** True when URL is a Jotform upload/file host we may proxy. */
export function isAllowedJotformUploadUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const allowedHost =
      host === "jotform.com" ||
      host.endsWith(".jotform.com") ||
      host === "jotformeu.com" ||
      host.endsWith(".jotformeu.com");
    if (!allowedHost) return false;
    // Prefer upload/CDN paths; still allow known form asset hosts under jotform.com
    return true;
  } catch {
    return false;
  }
}

function extractAttachmentsFromAnswer(answer: unknown, type?: string): IntakeAnswerAttachment[] {
  const attachments: IntakeAnswerAttachment[] = [];
  const isFileControl = type === "control_fileupload" || type === "control_widget";

  const pushUrl = (raw: unknown, nameHint?: string) => {
    if (typeof raw !== "string") return;
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url)) return;
    if (!isAllowedJotformUploadUrl(url)) return;
    const name = nameHint?.trim() || fileNameFromUrl(url);
    attachments.push({ name, url, kind: attachmentKind(url, name) });
  };

  if (typeof answer === "string") {
    if (isFileControl || /^https?:\/\//i.test(answer.trim())) {
      pushUrl(answer);
    }
    return attachments;
  }

  if (Array.isArray(answer)) {
    for (const item of answer) {
      if (typeof item === "string") {
        pushUrl(item);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const url = (obj.url ?? obj.link ?? obj.href ?? obj.path) as unknown;
        const name = typeof obj.name === "string" ? obj.name : undefined;
        pushUrl(url, name);
      }
    }
    return attachments;
  }

  if (answer && typeof answer === "object") {
    const obj = answer as Record<string, unknown>;
    if (obj.url || obj.link || obj.href) {
      pushUrl(obj.url ?? obj.link ?? obj.href, typeof obj.name === "string" ? obj.name : undefined);
    } else if (isFileControl) {
      for (const value of Object.values(obj)) {
        if (typeof value === "string" && /^https?:\/\//i.test(value)) {
          pushUrl(value);
        }
      }
    }
  }

  return attachments;
}

/** Fetch a Jotform upload with API auth for streaming to the patient. */
export async function fetchJotformUpload(remoteUrl: string): Promise<Response> {
  const { apiKey } = getJotformConfig();
  if (!isAllowedJotformUploadUrl(remoteUrl)) {
    throw new Error("URL is not an allowed Jotform host.");
  }

  const withKey = new URL(remoteUrl);
  if (apiKey && !withKey.searchParams.has("apiKey")) {
    withKey.searchParams.set("apiKey", apiKey);
  }

  const res = await fetch(withKey.toString(), {
    method: "GET",
    headers: {
      Accept: "*/*",
      ...(apiKey ? { APIKEY: apiKey } : {}),
    },
    cache: "no-store",
    redirect: "follow",
  });

  return res;
}

type JotformAnswer = {
  name?: string;
  text?: string;
  type?: string;
  answer?: unknown;
};

type JotformSubmissionItem = {
  id: string;
  form_id: string;
  created_at: string;
  status: string;
  answers?: Record<string, JotformAnswer>;
};

/**
 * Checks if a given QuickBlox client user, email, or patient profile has submitted the intake form.
 */
export type CheckJotformSubmissionParams = {
  qbUserId?: number | null;
  email?: string | null;
  fullName?: string | null;
  dob?: string | null;
  phone?: string | null;
  since?: string | Date | null;
  consultationId?: string | null;
  subscriptionId?: string | null;
  appointmentId?: string | null;
  excludeSubmissionIds?: string[];
};

type ExtractedSubmission = {
  clientId: string | null;
  consultationId: string | null;
  subscriptionId: string | null;
  appointmentId: string | null;
  email: string | null;
  fullName: string | null;
  dobYear: string | null;
  dobMonth: string | null;
  dobDay: string | null;
  phoneDigits: string | null;
};

function extractSubmissionDetails(answers: Record<string, JotformAnswer>): ExtractedSubmission {
  let clientId: string | null = null;
  let consultationId: string | null = null;
  let subscriptionId: string | null = null;
  let appointmentId: string | null = null;
  let email: string | null = null;
  let fullName: string | null = null;
  let dobYear: string | null = null;
  let dobMonth: string | null = null;
  let dobDay: string | null = null;
  let phoneDigits: string | null = null;

  for (const [key, ans] of Object.entries(answers)) {
    if (!ans || ans.answer === undefined || ans.answer === null) continue;

    // consultation_id / consultationId
    if (
      ans.name === "consultation_id" ||
      ans.name === "consultationId" ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("consultation_id")) ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("consultation id"))
    ) {
      if (typeof ans.answer === "string" || typeof ans.answer === "number") {
        consultationId = String(ans.answer).trim();
      }
    }

    // subscription_id / subscriptionId
    if (
      ans.name === "subscription_id" ||
      ans.name === "subscriptionId" ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("subscription_id")) ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("subscription id"))
    ) {
      if (typeof ans.answer === "string" || typeof ans.answer === "number") {
        subscriptionId = String(ans.answer).trim();
      }
    }

    // appointment_id / appointmentId
    if (
      ans.name === "appointment_id" ||
      ans.name === "appointmentId" ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("appointment_id")) ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("appointment id"))
    ) {
      if (typeof ans.answer === "string" || typeof ans.answer === "number") {
        appointmentId = String(ans.answer).trim();
      }
    }

    // client_id
    if (
      key === "63" ||
      ans.name === "client_id" ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("client_id"))
    ) {
      clientId = String(ans.answer).trim();
    }

    // email
    if (
      ans.type === "control_email" ||
      ans.name?.toLowerCase().includes("email") ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("email"))
    ) {
      if (typeof ans.answer === "string") {
        email = ans.answer.trim().toLowerCase();
      }
    }

    // full name
    if (
      ans.type === "control_fullname" ||
      ans.name?.toLowerCase().includes("fullname") ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("full name"))
    ) {
      if (typeof ans.answer === "object" && ans.answer !== null) {
        const obj = ans.answer as Record<string, unknown>;
        const first = String(obj.first || "").trim();
        const last = String(obj.last || "").trim();
        fullName = `${first} ${last}`.trim();
      } else if (typeof ans.answer === "string") {
        fullName = ans.answer.trim();
      }
    }

    // date of birth
    if (
      ans.type === "control_datetime" ||
      ans.name?.toLowerCase().includes("dateof") ||
      (typeof ans.text === "string" &&
        (ans.text.toLowerCase().includes("date of birth") ||
          ans.text.toLowerCase().includes("birth") ||
          ans.text.toLowerCase().includes("dob")))
    ) {
      if (typeof ans.answer === "object" && ans.answer !== null) {
        const obj = ans.answer as Record<string, unknown>;
        if (obj.year) dobYear = String(obj.year).trim();
        if (obj.month) dobMonth = String(obj.month).trim().padStart(2, "0");
        if (obj.day) dobDay = String(obj.day).trim().padStart(2, "0");
      } else if (typeof ans.answer === "string") {
        const parts = ans.answer.trim().split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            dobYear = parts[0];
            dobMonth = parts[1].padStart(2, "0");
            dobDay = parts[2].padStart(2, "0");
          } else {
            dobMonth = parts[0].padStart(2, "0");
            dobDay = parts[1].padStart(2, "0");
            dobYear = parts[2];
          }
        }
      }
    }

    // phone
    if (
      ans.type === "control_phone" ||
      ans.name?.toLowerCase().includes("phone") ||
      (typeof ans.text === "string" && ans.text.toLowerCase().includes("phone"))
    ) {
      if (typeof ans.answer === "object" && ans.answer !== null) {
        const obj = ans.answer as Record<string, unknown>;
        const p = String(obj.full || obj.phone || "").replace(/\D/g, "");
        if (p) phoneDigits = p;
      } else if (typeof ans.answer === "string") {
        const p = ans.answer.replace(/\D/g, "");
        if (p) phoneDigits = p;
      }
    }
  }

  return {
    clientId,
    consultationId,
    subscriptionId,
    appointmentId,
    email,
    fullName,
    dobYear,
    dobMonth,
    dobDay,
    phoneDigits,
  };
}

function parseJotformCreatedAt(dateStr: string): number {
  if (!dateStr) return NaN;
  const clean = dateStr.trim();
  if (!/[z+-]\d{2}/i.test(clean)) {
    const isoLike = clean.replace(" ", "T");
    const rawUtc = new Date(`${isoLike}Z`).getTime();
    if (!isNaN(rawUtc)) {
      // Jotform account operates in America/New_York (EDT UTC-4 from March-Nov, EST UTC-5 in winter)
      const d = new Date(isoLike);
      const m = d.getMonth();
      const offsetHours = m >= 2 && m <= 10 ? 4 : 5;
      return rawUtc + offsetHours * 3600 * 1000;
    }
  }
  return new Date(clean).getTime();
}

function isSubmissionMatch(
  extracted: ExtractedSubmission,
  params: CheckJotformSubmissionParams,
): boolean {
  // 1. Direct consultation ID match if provided (matches Supabase consultation ID or QB appointment ID)
  if (extracted.consultationId) {
    const extConsult = extracted.consultationId.trim().toLowerCase();
    if (params.consultationId && extConsult === params.consultationId.trim().toLowerCase()) {
      return true;
    }
    if (params.appointmentId && extConsult === params.appointmentId.trim().toLowerCase()) {
      return true;
    }
  }

  // 2. Direct subscription ID match if provided
  if (params.subscriptionId && extracted.subscriptionId) {
    if (
      params.subscriptionId.trim().toLowerCase() === extracted.subscriptionId.trim().toLowerCase()
    ) {
      return true;
    }
  }

  // 3. Direct appointment ID match if provided
  if (params.appointmentId && extracted.appointmentId) {
    if (
      params.appointmentId.trim().toLowerCase() === extracted.appointmentId.trim().toLowerCase()
    ) {
      return true;
    }
  }

  // 4. Exact match on QB User ID
  if (params.qbUserId && extracted.clientId) {
    if (String(params.qbUserId).trim() === extracted.clientId) {
      return true;
    }
  }

  // 5. Exact match on email
  if (params.email && extracted.email) {
    if (params.email.trim().toLowerCase() === extracted.email) {
      return true;
    }
  }

  // 6. Match on Name + corroborating DOB, Last name, or Phone
  if (params.fullName && extracted.fullName) {
    const targetNameNorm = params.fullName
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
    const subNameNorm = extracted.fullName
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();

    const targetTokens = targetNameNorm.split(/\s+/).filter(Boolean);
    const subTokens = subNameNorm.split(/\s+/).filter(Boolean);

    // First name match
    const firstNameMatch =
      targetTokens.length > 0 &&
      subTokens.length > 0 &&
      (targetTokens[0] === subTokens[0] ||
        (targetTokens[0].length >= 3 && subTokens[0].startsWith(targetTokens[0])) ||
        (subTokens[0].length >= 3 && targetTokens[0].startsWith(subTokens[0])));

    if (firstNameMatch) {
      // Check last name / initial match
      let lastNameMatch = false;
      if (targetTokens.length > 1 && subTokens.length > 1) {
        const tLast = targetTokens[1];
        const sLast = subTokens[1];
        if (tLast === sLast || tLast[0] === sLast[0]) {
          lastNameMatch = true;
        }
      }

      // Check DOB match
      let dobMatch = false;
      if (params.dob && extracted.dobYear) {
        const pYear = params.dob.slice(0, 4);
        const pMonth = params.dob.length >= 7 ? params.dob.slice(5, 7) : null;
        if (pYear === extracted.dobYear) {
          if (!pMonth || !extracted.dobMonth || pMonth === extracted.dobMonth) {
            dobMatch = true;
          }
        }
      }

      // Check Phone match
      let phoneMatch = false;
      if (params.phone && extracted.phoneDigits) {
        const pDigits = params.phone.replace(/\D/g, "");
        if (
          pDigits.length >= 7 &&
          extracted.phoneDigits.length >= 7 &&
          (pDigits.endsWith(extracted.phoneDigits.slice(-7)) ||
            extracted.phoneDigits.endsWith(pDigits.slice(-7)))
        ) {
          phoneMatch = true;
        }
      }

      // High-confidence match: First name + (DOB or Last name or Phone)
      if (dobMatch || lastNameMatch || phoneMatch) {
        return true;
      }

      // If user provided no DOB or target has single token, and first name matches
      if (!params.dob && (targetTokens.length === 1 || !subTokens[1])) {
        return true;
      }
    }
  }

  // 7. Match on DOB for submissions created specifically since this consultation began
  if (params.since && params.dob && extracted.dobYear && extracted.dobMonth && extracted.dobDay) {
    const pYear = params.dob.slice(0, 4);
    const pMonth = params.dob.length >= 7 ? params.dob.slice(5, 7) : null;
    const pDay = params.dob.length >= 10 ? params.dob.slice(8, 10) : null;
    if (
      pYear === extracted.dobYear &&
      (!pMonth || pMonth === extracted.dobMonth) &&
      (!pDay || pDay === extracted.dobDay)
    ) {
      return true;
    }
  }

  return false;
}

export async function checkJotformSubmission(
  params: CheckJotformSubmissionParams,
): Promise<JotformSubmissionResult> {
  const { apiKey, intakeFormId, apiBase } = getJotformConfig();
  if (!apiKey || !intakeFormId) {
    return { submitted: false, submissionId: null, submittedAt: null };
  }

  const targetUserIdStr = params.qbUserId ? String(params.qbUserId).trim() : null;
  const targetEmail = params.email ? params.email.trim().toLowerCase() : null;
  const targetName = params.fullName ? params.fullName.trim() : null;
  const sinceTime = params.since ? new Date(params.since).getTime() : null;

  if (
    !targetUserIdStr &&
    !targetEmail &&
    !targetName &&
    !params.consultationId &&
    !params.subscriptionId
  ) {
    return { submitted: false, submissionId: null, submittedAt: null };
  }

  try {
    // 1. Fetch recent submissions from HIPAA Jotform endpoint
    const url = `${apiBase}/form/${intakeFormId}/submissions?apiKey=${encodeURIComponent(apiKey)}&limit=50&orderby=created_at`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[Jotform] submissions check failed (${res.status}):`, await res.text());
      return { submitted: false, submissionId: null, submittedAt: null };
    }

    const data = (await res.json()) as { content?: JotformSubmissionItem[] };
    const submissions = Array.isArray(data.content) ? data.content : [];

    for (const sub of submissions) {
      if (sub.status && sub.status.toUpperCase() === "DELETED") continue;
      if (params.excludeSubmissionIds && params.excludeSubmissionIds.includes(sub.id)) {
        continue;
      }

      const extracted = extractSubmissionDetails(sub.answers || {});

      // 1. Direct consultation, subscription, or appointment ID match: 100% exact match
      const directIdMatch =
        (extracted.consultationId &&
          ((params.consultationId &&
            extracted.consultationId.trim().toLowerCase() ===
              params.consultationId.trim().toLowerCase()) ||
            (params.appointmentId &&
              extracted.consultationId.trim().toLowerCase() ===
                params.appointmentId.trim().toLowerCase()))) ||
        (params.subscriptionId &&
          extracted.subscriptionId &&
          params.subscriptionId.trim().toLowerCase() ===
            extracted.subscriptionId.trim().toLowerCase()) ||
        (params.appointmentId &&
          extracted.appointmentId &&
          params.appointmentId.trim().toLowerCase() ===
            extracted.appointmentId.trim().toLowerCase());

      if (directIdMatch) {
        return {
          submitted: true,
          submissionId: sub.id,
          submittedAt: sub.created_at,
        };
      }

      // 2. For fuzzy / demographic matching (name, DOB, email), enforce created since consultation began
      if (sinceTime && sub.created_at) {
        const subTime = parseJotformCreatedAt(sub.created_at);
        // Allow a 180s clock skew window
        if (!isNaN(subTime) && subTime < sinceTime - 180000) {
          continue;
        }
      }

      const matched = isSubmissionMatch(extracted, params);

      if (matched) {
        return {
          submitted: true,
          submissionId: sub.id,
          submittedAt: sub.created_at,
        };
      }
    }

    return { submitted: false, submissionId: null, submittedAt: null };
  } catch (error) {
    console.warn("[Jotform] error querying submissions:", error);
    return { submitted: false, submissionId: null, submittedAt: null };
  }
}

/**
 * Fetches structured answers for a given JotForm submission.
 */
export async function fetchJotformSubmissionAnswers(
  submissionId: string,
): Promise<IntakeAnswerItem[]> {
  const { apiKey, apiBase } = getJotformConfig();
  if (!apiKey || !submissionId || !/^\d+$/.test(submissionId.trim())) {
    return [];
  }

  try {
    const url = `${apiBase}/submission/${encodeURIComponent(submissionId.trim())}?apiKey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[Jotform] submission ${submissionId} answers fetch failed (${res.status})`);
      return [];
    }

    const data = (await res.json()) as { content?: { answers?: Record<string, JotformAnswer> } };
    const answers = data.content?.answers || {};
    const items: IntakeAnswerItem[] = [];

    for (const [key, item] of Object.entries(answers)) {
      if (!item || item.answer === undefined || item.answer === null || item.answer === "") {
        continue;
      }
      // Skip internal fields, headers, buttons
      if (
        item.name === "client_id" ||
        key === "63" ||
        item.type === "control_head" ||
        item.type === "control_button" ||
        item.type === "control_collapse"
      ) {
        continue;
      }

      const label = item.text || item.name || `Question ${key}`;
      const attachments = extractAttachmentsFromAnswer(item.answer, item.type);
      let val = item.answer;

      if (attachments.length > 0) {
        val = attachments.map((a) => a.name).join(", ");
      } else if (typeof val === "object" && val !== null) {
        if (Array.isArray(val)) {
          val = val.join(", ");
        } else {
          const obj = val as Record<string, unknown>;
          // Handle Date of Birth cleanly
          if (obj.year && obj.month && obj.day) {
            val = `${String(obj.month).padStart(2, "0")}/${String(obj.day).padStart(2, "0")}/${obj.year}`;
          } else if (obj.first || obj.last) {
            val = `${obj.first || ""} ${obj.last || ""}`.trim();
          } else {
            val = Object.values(obj)
              .filter((v) => v !== null && v !== undefined && String(v).trim().length > 0)
              .join(" ");
          }
        }
      }

      const valStr = String(val).trim();
      if (!valStr && attachments.length === 0) continue;

      items.push({
        label: label.trim(),
        value: valStr || attachments.map((a) => a.name).join(", "),
        ...(attachments.length > 0 ? { attachments } : {}),
      });
    }

    return items;
  } catch (error) {
    console.warn("[Jotform] error fetching submission answers:", error);
    return [];
  }
}
