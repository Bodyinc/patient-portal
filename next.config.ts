import type { NextConfig } from "next";

function getSupabaseHostname(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

const supabaseHostname = getSupabaseHostname();

const isDevCommand = process.argv.includes("dev");

const nextConfig: NextConfig = {
  // `next dev` and `next build` must not share `.next` — a running dev server
  // truncates app-path-routes-manifest.json and collect-page-data fails with ENOENT.
  distDir: process.env.NEXT_DIST_DIR || (isDevCommand ? ".next-dev" : ".next"),
  reactStrictMode: true,
  serverExternalPackages: ["nodemailer", "web-push"],
  // nodemailer is in serverExternalPackages so Turbopack never bundles it
  // on the client. An empty turbopack config silences the webpack-conflict error.
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        tls: false,
        net: false,
        fs: false,
      };
    }
    return config;
  },
  // Profile avatar uploads go through a Server Action; default limit is 1 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/onboarding/choose-medicine",
        destination: "/onboarding/medications",
        permanent: false,
      },
      { source: "/onboarding/quiz", destination: "/onboarding/goal", permanent: false },
      {
        source: "/onboarding/recommend2",
        destination: "/onboarding/medications",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
