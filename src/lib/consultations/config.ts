export const ELIGIBLE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export function isEligibleSubscriptionStatus(
  status: string,
): status is (typeof ELIGIBLE_SUBSCRIPTION_STATUSES)[number] {
  return (ELIGIBLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

export function getQuickbloxConfig() {
  const apiUrl = (process.env.QUICKBLOX_API_URL ?? "https://api-bodyinc.quickblox.com").replace(
    /\/$/,
    "",
  );
  const clientAppUrl = (
    process.env.QUICKBLOX_CLIENT_APP_URL ?? "https://client-bodyinc.quickblox.com"
  ).replace(/\/$/, "");
  const providerEmail = process.env.QUICKBLOX_PROVIDER_EMAIL?.trim() || "";
  const providerPassword = process.env.QUICKBLOX_PROVIDER_PASSWORD?.trim() || "";
  const apiKey = process.env.QUICKBLOX_API_KEY?.trim() || "";
  const userSecret = process.env.QUICKBLOX_USER_SECRET?.trim() || "";
  const providerIdRaw = process.env.QUICKBLOX_PROVIDER_ID?.trim() || "";
  const providerId = providerIdRaw ? Number(providerIdRaw) : null;
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
    providerId: Number.isFinite(providerId) ? providerId : null,
    appId,
    authKey,
    authSecret,
    accountKey,
  };
}

export function isQuickbloxConfigured() {
  const cfg = getQuickbloxConfig();
  const hasProviderAuth = Boolean(cfg.providerEmail && cfg.providerPassword);
  const hasApiKey = Boolean(cfg.apiKey && cfg.providerId);
  return Boolean(
    cfg.apiUrl && cfg.clientAppUrl && cfg.userSecret && (hasProviderAuth || hasApiKey),
  );
}
