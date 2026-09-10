"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

import {
  getFeedbackFormContext,
  submitPatientFeedback,
  type FeedbackFormContext,
} from "@/lib/actions/feedback";
import { cn } from "@/lib/utils";

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [context, setContext] = useState<FeedbackFormContext>({
    signedIn: false,
    collectContact: true,
    fullName: "",
    email: "",
  });
  const [message, setMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const onOnboarding = pathname.startsWith("/onboarding");
  const collectContact = context.collectContact;
  const showLabel = hovered && !open;

  useEffect(() => {
    void getFeedbackFormContext().then((next) => {
      setContext(next);
      setFullName((current) => current || next.fullName);
      setEmail((current) => current || next.email);
    });
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
    setHovered(false);
  }, [pathname]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitPatientFeedback({
        message,
        pagePath: pathname,
        email: collectContact ? email : "",
        fullName: collectContact ? fullName : "",
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setMessage("");
      if (!context.fullName) setFullName("");
      if (!context.email) setEmail("");
      setOpen(false);
      toast.success(
        context.signedIn
          ? "Thanks — we received your inquiry. Track it under My inquiries."
          : "Thanks — we received your inquiry and will email you when there is an update.",
      );
    });
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-[45] flex flex-col items-end gap-3 print:hidden sm:right-5",
        onOnboarding ? "bottom-24 sm:bottom-6" : "bottom-5",
      )}
    >
      {open ? (
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-[min(calc(100vw-2rem),360px)] origin-bottom-right rounded-[20px] border border-[#E8EEED] bg-white p-4 shadow-[0_12px_40px_rgba(21,42,81,0.16)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-medium tracking-[-0.25px] text-[#152A51]">
                How can we help?
              </p>
              <p className="mt-1 text-[13px] leading-snug text-[#152A51]/70">
                {collectContact ? (
                  <>
                    Leave your name and email so we can follow up.
                    {" We'll email you when there is an update."}
                  </>
                ) : context.signedIn ? (
                  <>
                    Track replies in{" "}
                    <Link href="/inquiries" className="underline underline-offset-2">
                      My inquiries
                    </Link>
                    .
                  </>
                ) : (
                  "We'll email you when there is an update."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#152A51]/60 hover:bg-[#F3F6F6] hover:text-[#152A51]"
              aria-label="Close support"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {collectContact ? (
            <>
              <input
                type="text"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
                className="mb-3 h-[42px] w-full rounded-[14px] border-0 bg-[#E8EEED] px-3 text-[14px] text-[#152A51] outline-none placeholder:text-[#152A51]/40"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email"
                className="mb-3 h-[42px] w-full rounded-[14px] border-0 bg-[#E8EEED] px-3 text-[14px] text-[#152A51] outline-none placeholder:text-[#152A51]/40"
              />
            </>
          ) : null}

          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what is going on…"
            className="mb-3 w-full resize-none rounded-[14px] border-0 bg-[#E8EEED] px-3 py-2.5 text-[14px] leading-snug text-[#152A51] outline-none placeholder:text-[#152A51]/40"
          />

          <button
            type="submit"
            disabled={pending}
            className="h-[42px] w-full rounded-full bg-[#E3E084] text-[14px] font-medium text-[#152A51] hover:bg-[#D9D674] disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send message"}
          </button>
        </form>
      ) : null}

      <div
        className="pointer-events-auto flex items-center justify-end gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap text-[14px] font-medium text-[#152A51] transition-all duration-200",
            showLabel ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0",
          )}
        >
          Need help?
        </span>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={open ? "Close support" : "Need help?"}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#152A51] text-white shadow-[0_8px_24px_rgba(21,42,81,0.28)] transition-all hover:bg-[#1c3668]"
        >
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
