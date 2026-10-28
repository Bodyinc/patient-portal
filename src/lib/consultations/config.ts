export const ELIGIBLE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export function isEligibleSubscriptionStatus(
  status: string,
): status is (typeof ELIGIBLE_SUBSCRIPTION_STATUSES)[number] {
  return (ELIGIBLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

export function getQuickbloxConfig() {
  let apiUrl = (process.env.QUICKBLOX_API_URL ?? "https://api.quickblox.com").replace(/\/$/, "");
  if (apiUrl.includes("api-bodyinc.quickblox.com")) {
    apiUrl = "https://api.quickblox.com";
  }

  let clientAppUrl = (
    process.env.QUICKBLOX_CLIENT_APP_URL ?? "https://client.quickblox.com"
  ).replace(/\/$/, "");
  if (clientAppUrl.includes("client-bodyinc.quickblox.com")) {
    clientAppUrl = "https://client.quickblox.com";
  }

  const providerEmail = process.env.QUICKBLOX_PROVIDER_EMAIL?.trim() || "admin@quickblox.com";
  const providerPassword = process.env.QUICKBLOX_PROVIDER_PASSWORD?.trim() || "Password2026";
  const apiKey = process.env.QUICKBLOX_API_KEY?.trim() || "";
  const userSecret =
    process.env.QUICKBLOX_USER_SECRET?.trim() || "qwe12rty34uio56p5asd67fgh7jklz8xcv5bnm8";
  const providerIdRaw = process.env.QUICKBLOX_PROVIDER_ID?.trim() || "142814409";
  const providerId = providerIdRaw ? Number(providerIdRaw) : 142814409;
  const appIdRaw =
    process.env.QUICKBLOX_APP_ID?.trim() ||
    process.env.NEXT_PUBLIC_QUICKBLOX_APP_ID?.trim() ||
    "108471";
  const appId = Number(appIdRaw) || 108471;
  const authKey =
    process.env.QUICKBLOX_AUTH_KEY?.trim() ||
    process.env.NEXT_PUBLIC_QUICKBLOX_AUTH_KEY?.trim() ||
    "ak_xjJy9Tuv9jDgdEw";
  const authSecret =
    process.env.QUICKBLOX_AUTH_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_QUICKBLOX_AUTH_SECRET?.trim() ||
    "as_S6-E5A6Dwz-T2qb";
  const accountKey =
    process.env.QUICKBLOX_ACCOUNT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_QUICKBLOX_ACCOUNT_KEY?.trim() ||
    "ack_UzqY8uy_UqMnkY3wyMpQ";

  return {
    apiUrl,
    clientAppUrl,
    providerEmail,
    providerPassword,
    apiKey,
    userSecret,
    providerId: Number.isFinite(providerId) ? providerId : 142814409,
    appId,
    authKey,
    authSecret,
    accountKey,
  };
}

export function isQuickbloxConfigured() {
  const cfg = getQuickbloxConfig();
  const hasAppAuth = Boolean(cfg.appId && cfg.authKey && cfg.authSecret && cfg.accountKey);
  const hasProviderAuth = Boolean((cfg.providerEmail && cfg.providerPassword) || cfg.providerId);
  return Boolean(hasAppAuth && cfg.userSecret && hasProviderAuth);
}
