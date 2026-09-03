import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans } from "next/font/google";

import { Providers } from "./providers";
import { ServiceWorkerCleanup } from "./service-worker-cleanup";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const benignErrorGuardScript = `
(function () {
  function swallowResourceError(e) {
    var t = e.target;
    if (t && t.tagName === "IMG") {
      e.stopImmediatePropagation();
    }
  }
  function swallowBenignRejection(e) {
    var r = e.reason;
    if (r && typeof Event !== "undefined" && r instanceof Event && r.type === "error") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  window.addEventListener("error", swallowResourceError, true);
  window.addEventListener("unhandledrejection", swallowBenignRejection, true);
})();
`;

export const metadata: Metadata = {
  title: {
    default: "BodyInc · Patient Portal",
    template: "%s · BodyInc Patient Portal",
  },
  description: "Access your BodyInc patient account, appointments, and care plan.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/fevicone.svg", type: "image/svg+xml" },
    ],
    shortcut: "/fevicone.svg",
    apple: "/fevicone.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={dmSans.className}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@8..144,400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Script id="benign-error-guard" strategy="beforeInteractive">
          {benignErrorGuardScript}
        </Script>
        <ServiceWorkerCleanup />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
