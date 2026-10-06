"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  IntakeAnswerItem,
  PatientConsultationData,
  QuickbloxSdkConfig,
} from "@/lib/consultations/types";
import { verifyAndRecordJotformSubmission } from "@/lib/consultations/actions";

type JotformIntakeStepProps = {
  subscriptionId: string;
  sdkConfig: QuickbloxSdkConfig;
  patientData: PatientConsultationData;
  onComplete: (submission: { submissionId: string | null; answers: IntakeAnswerItem[] }) => void;
};

export default function JotformIntakeStep({
  subscriptionId,
  sdkConfig,
  patientData,
  onComplete,
}: JotformIntakeStepProps) {
  const router = useRouter();
  const [iframeLoading, setIframeLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const completedRef = useRef(false);

  // Construct Jotform URL with pre-filled parameters
  const jotformUrl = (() => {
    const base = `https://form.jotform.com/${sdkConfig.intakeFormId}`;
    const params = new URLSearchParams();
    if (sdkConfig.userId) params.set("client_id", String(sdkConfig.userId));
    if (patientData.email) params.set("email", patientData.email);

    // Pre-fill name both as raw and subfields for Jotform control_fullname
    if (patientData.fullName) {
      params.set("fullName", patientData.fullName);
      const nameParts = patientData.fullName.trim().split(/\s+/);
      const first = nameParts[0] || "";
      const last = nameParts.slice(1).join(" ") || first;
      params.set("fullName[first]", first);
      params.set("fullName[last]", last);
    }

    // Pre-fill DOB subfields for Jotform control_datetime (qid 5)
    if (patientData.dob) {
      const parts = patientData.dob.trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          params.set("dateOf[year]", parts[0]);
          params.set("dateOf[month]", parts[1].padStart(2, "0"));
          params.set("dateOf[day]", parts[2].padStart(2, "0"));
        }
      }
    }

    // Pre-fill biological sex (qid 10)
    if (patientData.sex) {
      params.set("biologicalSex", patientData.sex.toLowerCase() === "female" ? "Female" : "Male");
    }

    if (subscriptionId) {
      params.set("subscription_id", subscriptionId);
      params.set("subscriptionId", subscriptionId);
    }
    if (sdkConfig.appointmentId) {
      params.set("appointment_id", sdkConfig.appointmentId);
      params.set("appointmentId", sdkConfig.appointmentId);
      params.set("consultation_id", sdkConfig.appointmentId);
      params.set("consultationId", sdkConfig.appointmentId);
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  })();

  const handleVerifySubmission = useCallback(
    async (providedSubId?: string) => {
      if (completedRef.current || verifying) return;
      setVerifying(true);
      setErrorMessage(null);
      setStatusMessage("Checking your intake submission status…");

      try {
        const result = await verifyAndRecordJotformSubmission({
          subscriptionId,
          appointmentId: sdkConfig.appointmentId,
          submissionId: providedSubId,
        });

        if (result.ok && result.submitted) {
          completedRef.current = true;
          setSubmittedSuccess(true);
          setStatusMessage("Intake verified! Entering consultation room…");
          setTimeout(() => {
            onComplete({
              submissionId: result.submissionId,
              answers: result.answers || [],
            });
          }, 1200);
        } else {
          setErrorMessage(
            result.message ||
              "We have not received your submission yet. Please click Submit on the form below.",
          );
          setStatusMessage(null);
        }
      } catch (err) {
        console.warn("[JotformIntakeStep] Verification error:", err);
        setErrorMessage("Unable to verify submission. Please try again.");
        setStatusMessage(null);
      } finally {
        setVerifying(false);
      }
    },
    [subscriptionId, sdkConfig.appointmentId, verifying, onComplete],
  );

  // Listen for Jotform postMessage events from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      try {
        const data = event.data;
        if (!data) return;

        // JotForm postMessage patterns:
        // 1. String "submission-completed" or object with action: "submission-completed"
        // 2. data.type === "submission-completed" or data.event === "submission-completed"
        const isCompleted =
          data === "submission-completed" ||
          (typeof data === "string" && data.includes("submission-completed")) ||
          (typeof data === "object" &&
            (data.action === "submission-completed" ||
              data.type === "submission-completed" ||
              data.event === "submission-completed"));

        if (isCompleted && !completedRef.current) {
          const submissionId =
            typeof data === "object" && typeof data.submissionID === "string"
              ? data.submissionID
              : undefined;
          void handleVerifySubmission(submissionId);
        }
      } catch (err) {
        console.warn("[JotformIntakeStep] message listener error:", err);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleVerifySubmission]);

  // Periodic poll check every 5 seconds to automatically detect if submitted
  useEffect(() => {
    if (completedRef.current || submittedSuccess) return;

    const interval = setInterval(() => {
      if (!completedRef.current && !verifying) {
        void (async () => {
          try {
            const result = await verifyAndRecordJotformSubmission({
              subscriptionId,
              appointmentId: sdkConfig.appointmentId,
            });
            if (result.ok && result.submitted && !completedRef.current) {
              completedRef.current = true;
              setSubmittedSuccess(true);
              setStatusMessage("Intake verified! Entering consultation room…");
              setTimeout(() => {
                onComplete({
                  submissionId: result.submissionId,
                  answers: result.answers || [],
                });
              }, 1200);
            }
          } catch {
            // Ignore polling errors
          }
        })();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [subscriptionId, sdkConfig.appointmentId, submittedSuccess, verifying, onComplete]);

  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-[#F9FBFA] text-[#152A51]">
      {/* Top Navigation & Stepper Header */}
      <header className="sticky top-0 z-20 border-b border-[#E8EEED] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/consultations")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E8EEED] text-[#152A51] transition hover:bg-[#F3F6F6]"
              title="Return to Consultations"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#152A51]/5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#152A51]">
                  Step 1 of 2
                </span>
                <span className="text-xs font-medium text-[#152A51]/60">
                  {patientData.medicineName} Consultation
                </span>
              </div>
              <h1 className="text-base font-semibold tracking-tight text-[#152A51] sm:text-lg">
                Medical Intake Questionnaire
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>HIPAA Compliant & Encrypted</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
        {/* Informational Guidance Banner */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-[#E8EEED] bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#152A51]/10 text-[#152A51]">
                <FileText className="h-5 w-5 text-[#152A51]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#152A51] sm:text-base">
                  Please Complete Your Confidential Intake
                </h2>
                <p className="mt-0.5 text-xs text-[#152A51]/75 sm:text-sm">
                  Your medical history ensures your provider can prescribe the safest, most
                  effective dosage. Once submitted, you will immediately advance to the consultation
                  room.
                </p>
              </div>
            </div>

            <Button
              type="button"
              disabled={verifying || submittedSuccess}
              onClick={() => void handleVerifySubmission()}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#152A51] px-5 text-xs font-medium text-white shadow-xs transition hover:bg-[#152A51]/90 sm:text-sm"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking Status…</span>
                </>
              ) : submittedSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>Submitted!</span>
                </>
              ) : (
                <>
                  <span>I’ve Completed This Form</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {statusMessage ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="flex-1">{errorMessage}</span>
              <button
                type="button"
                onClick={() => void handleVerifySubmission()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 underline hover:no-underline"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* JotForm Iframe Container */}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-[#E8EEED] bg-white shadow-xs">
          {iframeLoading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white p-6">
              <Loader2 className="h-8 w-8 animate-spin text-[#152A51]" />
              <p className="mt-3 text-sm font-medium text-[#152A51]">
                Loading medical intake form…
              </p>
              <p className="mt-1 text-xs text-[#152A51]/60">
                Securing confidential form connection
              </p>
            </div>
          ) : null}

          <iframe
            src={jotformUrl}
            title="Peptide Therapy Medical Intake Form"
            className="h-full min-h-[750px] w-full flex-1 border-0"
            allow="camera; microphone; geolocation"
            onLoad={() => setIframeLoading(false)}
          />
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-4 z-10 mt-4 rounded-2xl border border-[#E8EEED] bg-white/95 p-3.5 shadow-lg backdrop-blur-md sm:p-4">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-[#152A51]/75">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Form submitted? Click below to enter your consultation room immediately.</span>
            </div>

            <Button
              type="button"
              disabled={verifying || submittedSuccess}
              onClick={() => void handleVerifySubmission()}
              className="h-11 w-full rounded-full bg-[#152A51] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#152A51]/90 sm:w-auto"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Intake…</span>
                </>
              ) : submittedSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>Entering Consultation…</span>
                </>
              ) : (
                <>
                  <span>Enter Consultation Room</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
