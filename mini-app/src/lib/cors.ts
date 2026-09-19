/**
 * CORS Allowlist and Header Helpers
 * Resolves Issue #943: Replace wildcard CORS with domain allowlist
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.onton.live",
  "https://app.dev.onton.live",
  "https://onton.live",
  "https://admin.onton.live",
  "https://client-web.onton.live",
  "https://storage.onton.live",
];

const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3003",
];

export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.ENV === "development";

  return Array.from(
    new Set([
      ...DEFAULT_ALLOWED_ORIGINS,
      ...envOrigins,
      ...(isDev ? LOCAL_DEV_ORIGINS : []),
    ])
  );
}

export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

export function getCorsHeaders(origin: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key, x-init-data, x-signature, x-timestamp",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}
