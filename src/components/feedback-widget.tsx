"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

import { submitPatientFeedback } from "@/lib/actions/feedback";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const onOnboarding = pathname.startsWith("/onboarding");

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
    });
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitPatientFeedback({
        message,
        pagePath: pathname,
        email: signedIn ? "" : email,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setMessage("");
      setEmail("");
      setOpen(false);
      toast.success("Thanks — we received your inquiry.");
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
          className="pointer-events-auto w-[min(calc(100vw-2rem),360px)] rounded-[20px] border border-[#E8EEED] bg-white p-4 shadow-[0_12px_40px_rgba(21,42,81,0.16)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-medium tracking-[-0.25px] text-[#152A51]">
                Send feedback
              </p>
              <p className="mt-1 text-[13px] leading-snug text-[#152A51]/70">
                We&apos;d love to hear your inquiry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#152A51]/60 hover:bg-[#F3F6F6] hover:text-[#152A51]"
              aria-label="Close feedback"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!signedIn ? (
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email"
              className="mb-3 h-[42px] w-full rounded-[14px] border-0 bg-[#E8EEED] px-3 text-[14px] text-[#152A51] outline-none placeholder:text-[#152A51]/40"
            />
          ) : null}

          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Please write us your inquiry or feedback here..."
            className="mb-3 w-full resize-none rounded-[14px] border-0 bg-[#E8EEED] px-3 py-2.5 text-[14px] leading-snug text-[#152A51] outline-none placeholder:text-[#152A51]/40"
          />

          <button
            type="submit"
            disabled={pending}
            className="h-[42px] w-full rounded-full bg-[#E3E084] text-[14px] font-medium text-[#152A51] hover:bg-[#D9D674] disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send inquiry"}
          </button>
        </form>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Close feedback" : "Send feedback"}
        className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-[#152A51] px-4 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(21,42,81,0.28)] hover:bg-[#1c3668]"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span className="pr-0.5">{open ? "Close" : "Feedback"}</span>
      </button>
    </div>
  );
}
