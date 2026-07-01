import Image from "next/image";
import type { ReactNode } from "react";

type OnboardingShellProps = {
  children: ReactNode;
  showLogo?: boolean;
};

export default function OnboardingShell({ children, showLogo = true }: OnboardingShellProps) {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg- px-4 py-2 sm:px-6 sm:py-3 lg:px-10">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        priority
        className="pointer-events-none object-cover opacity-40"
      />
      {showLogo && (
        <header className="relative z-10 mb-4 shrink-0 h-20 flex items-center sm:h-24 lg:h-28">
          <Image
            src="/logo.svg"
            alt="BodyInc"
            width={260}
            height={100}
            priority
            className="h-12 w-auto sm:h-14 lg:h-16"
          />
        </header>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </main>
  );
}
