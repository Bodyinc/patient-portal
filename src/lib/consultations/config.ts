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

  return {
    apiUrl,
    clientAppUrl,
    providerEmail,
    providerPassword,
    apiKey,
    userSecret,
    providerId: Number.isFinite(providerId) ? providerId : null,
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
