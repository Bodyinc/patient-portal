"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle2, Loader2, Video, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startConsultation, recordConsultationFinished } from "@/lib/consultations/actions";
import type {
  IntakeAnswerItem,
  PatientConsultationData,
  QuickbloxSdkConfig,
} from "@/lib/consultations/types";

import JotformIntakeStep from "./JotformIntakeStep";
import QuickbloxConsultationRoom from "./QuickbloxConsultationRoom";

type OpenConsultationViewProps = {
  subscriptionId: string;
};

export default function OpenConsultationView({ subscriptionId }: OpenConsultationViewProps) {
  const router = useRouter();

  // Consultation lifecycle state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [sdkConfig, setSdkConfig] = useState<QuickbloxSdkConfig | null>(null);
  const [patientData, setPatientData] = useState<PatientConsultationData | null>(null);
  const [hasIntakeSubmitted, setHasIntakeSubmitted] = useState(false);

  const isFinishedRef = useRef(false);
  isFinishedRef.current = isFinished;

  const initConsultation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await startConsultation(subscriptionId);
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      if (result.isFinished) {
        setIsFinished(true);
        void recordConsultationFinished({
          subscriptionId,
          appointmentId: result.appointmentId,
        });
      }

      if (result.sdkConfig) {
        setSdkConfig(result.sdkConfig);
      }

      if (result.patientData) {
        setPatientData(result.patientData);
      }

      const formDone = Boolean(result.hasFormSubmission || result.patientData?.intakeSubmitted);
      setHasIntakeSubmitted(formDone);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to load consultation. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    void initConsultation();
  }, [initConsultation]);

  // Periodic check: consultation finished, case assigned, or chat dialog ready
  useEffect(() => {
    if (isFinished || loading || error) return;

    const interval = setInterval(async () => {
      try {
        if (isFinishedRef.current) return;
        const res = await startConsultation(subscriptionId);
        if (!res.ok) return;

        if (res.isFinished) {
          isFinishedRef.current = true;
          setIsFinished(true);
          void recordConsultationFinished({
            subscriptionId,
            appointmentId: res.appointmentId,
          });
        }

        if (res.sdkConfig) {
          setSdkConfig((prev) => {
            if (!prev) return res.sdkConfig ?? null;
            const next = res.sdkConfig!;
            if (
              prev.caseAssigned === next.caseAssigned &&
              prev.dialogId === next.dialogId &&
              (prev.dialogJid ?? null) === (next.dialogJid ?? null) &&
              prev.providerId === next.providerId &&
              (prev.providerName ?? null) === (next.providerName ?? null)
            ) {
              return prev;
            }
            return { ...prev, ...next, token: next.token || prev.token };
          });
        }
      } catch (e) {
        console.warn("[OpenConsultationView] Lifecycle check error:", e);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isFinished, loading, error, subscriptionId]);

  // Handle completion of Jotform intake step
  const handleIntakeComplete = useCallback(
    (submission: { submissionId: string | null; answers: IntakeAnswerItem[] }) => {
      setHasIntakeSubmitted(true);
      if (patientData) {
        setPatientData({
          ...patientData,
          intakeSubmitted: true,
          intakeSubmissionId: submission.submissionId,
          intakeAnswers:
            submission.answers.length > 0 ? submission.answers : patientData.intakeAnswers,
        });
      }
    },
    [patientData],
  );

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex min-h-[500px] w-full flex-1 flex-col items-center justify-center bg-[#F9FBFA] p-6 text-[#152A51]">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-[#E8EEED] bg-white p-8 text-center shadow-xs sm:p-10">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#152A51]/10 text-[#152A51]">
            <Stethoscope className="h-8 w-8 text-[#152A51] animate-pulse" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#152A51]">Preparing Your Consultation</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[#152A51]/70">
            Connecting to your confidential healthcare environment…
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs font-medium text-[#152A51]/60">
            <Loader2 className="h-4 w-4 animate-spin text-[#152A51]" />
            <span>Verifying medical profile & session</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="flex min-h-[500px] w-full flex-1 flex-col items-center justify-center bg-[#F9FBFA] p-6 text-[#152A51]">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xs sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Video className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-[#152A51]">Unable to Start Consultation</h2>
          <p className="mt-2 max-w-md text-sm text-[#152A51]/80 leading-relaxed">{error}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={() => void initConsultation()}
              className="h-10 rounded-full bg-[#152A51] px-6 text-sm font-medium text-white hover:bg-[#152A51]/90"
            >
              Try Again
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/consultations")}
              className="h-10 rounded-full border-[#E8EEED] px-6 text-sm font-medium text-[#152A51]"
            >
              Return to Consultations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Consultation finished state is rendered inline in QuickbloxConsultationRoom so chat remains available

  // 4. Missing Config State
  if (!sdkConfig || !patientData) {
    return (
      <div className="flex min-h-[500px] w-full flex-1 flex-col items-center justify-center bg-[#F9FBFA] p-6 text-[#152A51]">
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-center">
          <p className="text-sm text-red-600">Consultation credentials could not be loaded.</p>
          <Button
            type="button"
            onClick={() => router.push("/consultations")}
            className="mt-4 h-9 rounded-full bg-[#152A51] px-4 text-xs text-white"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  // 5. Flow Step 1: If JotForm intake has NOT been submitted yet -> Show JotForm Intake Step
  if (!hasIntakeSubmitted) {
    return (
      <JotformIntakeStep
        subscriptionId={subscriptionId}
        sdkConfig={sdkConfig}
        patientData={patientData}
        onComplete={handleIntakeComplete}
      />
    );
  }

  // 6. Flow Step 2: Live QuickBlox SDK Consultation Room (Chat, Inbound Calls, Patient & Intake Details)
  return (
    <QuickbloxConsultationRoom
      subscriptionId={subscriptionId}
      sdkConfig={sdkConfig}
      patientData={patientData}
      isFinished={isFinished}
      onFinish={() => {
        setIsFinished(true);
      }}
    />
  );
}
