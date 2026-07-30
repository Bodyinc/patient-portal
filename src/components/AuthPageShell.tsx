import Image from "next/image";
import type { ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthPageShell({ children, footer }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-white">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        priority
        className="pointer-events-none object-cover opacity-40"
      />

      <div className="absolute left-4 top-4 z-10 sm:left-8 sm:top-8">
        <Image
          src="/logo.svg"
          alt="BodyInc"
          width={160}
          height={50}
          priority
          className="h-8 w-auto sm:h-10"
        />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-[502px]">{children}</div>
      </main>

      {footer ?? (
        <footer className="relative z-10 shrink-0 pb-6 pt-2 text-center text-[13px] text-[#A6A6A6] sm:pb-8">
          © 2026 BodyInc
        </footer>
      )}
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 text-center sm:mb-10">
      <h1 className="text-2xl font-medium leading-tight text-[#152A51] sm:text-3xl lg:text-[37px]">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-base leading-snug text-[#152A51]/80 sm:mt-4 sm:text-lg lg:text-xl">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export const authInputClassName =
  "h-11 rounded-[14px] border-0 bg-[#E8EEED] px-4 text-[15px] text-[#152A51] placeholder:text-[#152A51]/40 shadow-none focus-visible:border-0 focus-visible:ring-0 sm:h-[51px]";

export const authButtonClassName =
  "h-11 w-full rounded-full bg-[#E3E084] text-base font-medium text-[#152A51] shadow-none hover:bg-[#D9D674] sm:h-[52px] sm:text-[18px]";

export const authOutlineButtonClassName =
  "h-11 w-full rounded-full border border-[#152A51]/30 bg-white text-base font-medium text-[#152A51] shadow-none transition-colors hover:border-[#152A51]/30 hover:bg-[#F3F6F6] hover:text-[#152A51] sm:h-[52px] sm:text-[18px]";
