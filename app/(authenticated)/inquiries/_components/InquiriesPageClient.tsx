"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmInquirySolved, replyToInquiry, type PatientInquiry } from "@/lib/actions/feedback";
import { canPatientConfirm, canPatientReply, feedbackStatusLabel } from "@/lib/feedback-status";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  switch (status) {
    case "needs_info":
      return "bg-[#E3E084] text-[#152A51]";
    case "awaiting_confirmation":
      return "bg-[#E3E084] text-[#152A51]";
    case "resolved":
      return "bg-[#E8EEED] text-[#152A51]";
    case "closed":
      return "bg-[#F3F6F6] text-[#152A51]/70";
    case "in_progress":
      return "bg-[#152A51] text-white";
    default:
      return "bg-[#F3F6F6] text-[#152A51]";
  }
}

function InquiryCard({ inquiry }: { inquiry: PatientInquiry }) {
  const router = useRouter();
  const [open, setOpen] = useState(
    inquiry.status === "needs_info" || inquiry.status === "awaiting_confirmation",
  );
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const allowReply = canPatientReply(inquiry.status);
  const allowConfirm = canPatientConfirm(inquiry.status);

  function submitReply() {
    startTransition(async () => {
      const result = await replyToInquiry({ id: inquiry.id, body: reply });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setReply("");
      toast.success("Reply sent — we will email you when the team responds.");
      router.refresh();
    });
  }

  function confirmSolved() {
    startTransition(async () => {
      const result = await confirmInquirySolved(inquiry.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Thanks — we marked this as resolved.");
      router.refresh();
    });
  }

  return (
    <article className="rounded-[20px] border border-[#E8EEED] bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:px-5"
      >
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug text-[#152A51]">
            {inquiry.message}
          </p>
          <p className="mt-1 text-[13px] text-[#152A51]/60">{formatDateTime(inquiry.updated_at)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${statusClass(inquiry.status)}`}
        >
          {feedbackStatusLabel(inquiry.status)}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[#E8EEED] px-4 py-4 sm:px-5">
          <div className="rounded-[16px] bg-[#F3F6F6] p-3">
            <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-[#152A51]/50">
              Your inquiry
            </p>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#152A51]">
              {inquiry.message}
            </p>
          </div>

          {inquiry.replies.map((item) => (
            <div
              key={item.id}
              className={
                item.author_role === "admin"
                  ? "rounded-[16px] bg-[#152A51] p-3 text-white"
                  : "rounded-[16px] border border-[#E8EEED] p-3"
              }
            >
              <p
                className={`mb-1 text-[12px] font-medium ${
                  item.author_role === "admin" ? "text-white/70" : "text-[#152A51]/50"
                }`}
              >
                {item.author_role === "admin" ? "Body Inc team" : "You"} ·{" "}
                {formatDateTime(item.created_at)}
              </p>
              <p
                className={`whitespace-pre-wrap text-[14px] leading-relaxed ${
                  item.author_role === "admin" ? "text-white" : "text-[#152A51]"
                }`}
              >
                {item.body}
              </p>
            </div>
          ))}

          {allowConfirm ? (
            <div className="rounded-[16px] bg-[#F3F6F6] p-3">
              <p className="text-[14px] text-[#152A51]">
                Did this reply solve your issue? If we don&apos;t hear from you in 3 days,
                we&apos;ll mark it resolved.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={confirmSolved}
                className="mt-3 h-[42px] rounded-full bg-[#152A51] px-5 text-[14px] font-medium text-white hover:bg-[#1c3668] disabled:opacity-60"
              >
                {pending ? "Saving…" : "Yes, this solved it"}
              </button>
            </div>
          ) : null}

          {allowReply ? (
            <div>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={3}
                minLength={10}
                maxLength={2000}
                placeholder={
                  inquiry.status === "needs_info"
                    ? "Add the details they asked for…"
                    : inquiry.status === "awaiting_confirmation"
                      ? "Still need help? Tell us what is left…"
                      : "Add more detail or ask a follow-up…"
                }
                className="mb-3 w-full resize-none rounded-[14px] border-0 bg-[#E8EEED] px-3 py-2.5 text-[14px] leading-snug text-[#152A51] outline-none placeholder:text-[#152A51]/40"
              />
              <button
                type="button"
                disabled={pending || reply.trim().length < 10}
                onClick={submitReply}
                className="h-[42px] rounded-full bg-[#E3E084] px-5 text-[14px] font-medium text-[#152A51] hover:bg-[#D9D674] disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send reply"}
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-[#152A51]/70">
              This inquiry is closed. Send a new one from Feedback if you still need help.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function InquiriesPageClient({ inquiries }: { inquiries: PatientInquiry[] }) {
  return (
    <div className="w-full space-y-4">
      <section className="rounded-[20px] bg-[#F3F6F6] px-4 py-4 sm:px-6 sm:py-5">
        <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
          My inquiries
        </h1>
        <p className="mt-1 text-sm text-[#152A51]/80 sm:text-[15px]">
          Track your questions and replies from the Body Inc team. We will also email you when there
          is an update.
        </p>
      </section>

      {inquiries.length === 0 ? (
        <div className="rounded-[20px] border border-[#E8EEED] px-4 py-10 text-center">
          <p className="text-[16px] font-medium text-[#152A51]">No inquiries yet</p>
          <p className="mt-1 text-[14px] text-[#152A51]/70">
            Use the Feedback button to send a question. It will show up here so you can follow
            along.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      )}
    </div>
  );
}
