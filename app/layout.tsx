import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { DM_Sans } from "next/font/google";

import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";
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
  applicationName: "BodyInc",
  appleWebApp: {
    capable: true,
    title: "BodyInc",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/fevicone.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icons/icon-192.png",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#152A51",
  width: "device-width",
  initialScale: 1,
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
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
