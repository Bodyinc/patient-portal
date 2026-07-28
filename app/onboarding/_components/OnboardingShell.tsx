import type { ReactNode } from "react";

type OnboardingShellProps = {
  children: ReactNode;
  showLogo?: boolean;
};

export default function OnboardingShell({ children, showLogo = true }: OnboardingShellProps) {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-white px-4 py-2 sm:px-6 sm:py-3 lg:px-10">
      {showLogo ? (
        <header className="relative z-10 mb-4 flex h-20 shrink-0 items-center justify-center sm:h-24 lg:h-28">
          {/* Plain img — next/image can reject with [object Event] when the shell remounts on each step. */}
          <img
            src="/logo.svg"
            alt="Body Inc."
            width={214}
            height={75}
            className="h-12 w-auto sm:h-14 lg:h-16"
          />
        </header>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </main>
  );
}
