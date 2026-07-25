/**
 * Application deployment environment for feature flags (rate limits, etc.).
 * Prefer APP_ENV; falls back to NODE_ENV when APP_ENV is unset.
 */
export type AppEnvMode = "development" | "production";

export function resolveAppEnv(
  appEnv = process.env.APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): AppEnvMode {
  const raw = (appEnv ?? nodeEnv ?? "development").trim().toLowerCase();

  if (raw === "production" || raw === "prod") {
    return "production";
  }

  // development | dev | test | anything else → no prod-only enforcement
  return "development";
}

export function isProductionAppEnv(): boolean {
  return resolveAppEnv() === "production";
}

export function isDevelopmentAppEnv(): boolean {
  return resolveAppEnv() === "development";
}
