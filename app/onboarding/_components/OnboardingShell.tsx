import Image from "next/image";
import type { ReactNode } from "react";

type OnboardingShellProps = {
  children: ReactNode;
  showLogo?: boolean;
};

export default function OnboardingShell({ children, showLogo = true }: OnboardingShellProps) {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-white px-4 py-2 sm:px-6 sm:py-3 lg:px-10">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        priority
        className="pointer-events-none object-cover opacity-40"
      />

      {showLogo && (
        <header className="relative z-10 shrink-0">
          <Image
            src="/logo.svg"
            alt="BodyInc"
            width={140}
            height={40}
            priority
            className="h-7 w-auto sm:h-9"
          />
        </header>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </main>
  );
}
