import crypto from "node:crypto";

/* ------------------------------------------------------------------ */
/*                       ✦  tiny helpers  ✦                           */
/* ------------------------------------------------------------------ */
const base64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomUrlSafeString = (bytes = 32) => base64url(crypto.randomBytes(bytes));

const sha256base64url = (str: string) => base64url(crypto.createHash("sha256").update(str).digest());

/* ------------------------------------------------------------------ */
/*                  1)  makeGoogleAuthUrl() export                    */
/* ------------------------------------------------------------------ */
/**
 * Generates a Google OAuth‑2 PKCE authorize URL.
 * Returns the URL **plus** the `codeVerifier` and random `state`
 *   (‑ you must stash both in Redis until the callback arrives).
 */
export function makeGoogleAuthUrl(): {
  url: string;
  codeVerifier: string;
  state: string;
} {
  /* ❶  PKCE code‑verifier / challenge */
  const codeVerifier = randomUrlSafeString(64); // ≥ 43 chars
  const codeChallenge = sha256base64url(codeVerifier);

  /* ❷  CSRF state token */
  const state = randomUrlSafeString(32);

  /* ❸  Build URL */
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  auth.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/google/callback`);
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("code_challenge", codeChallenge);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("state", state);
  auth.searchParams.set("access_type", "offline"); // refresh‑token

  return {
    url: auth.toString(),
    codeVerifier,
    state,
  };
}

/* ------------------------------------------------------------------ */
/*           2)  code  →  { access_token, id_token, … }               */
/* ------------------------------------------------------------------ */
export async function exchangeCodeForTokenGoogle(
  code: string,
  codeVerifier: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const tokenUrl = "https://oauth2.googleapis.com/token";

  const body = new URLSearchParams({
    code,
    code_verifier: codeVerifier,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/google/callback`,
    grant_type: "authorization_code",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${txt}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  }>;
}

/* ------------------------------------------------------------------ */
/*            3)  access_token  →  /userinfo profile                  */
/* ------------------------------------------------------------------ */
export interface GoogleUserInfo {
  sub: string; // Google user‑id
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Fetching Google userinfo failed: ${res.status} ${txt}`);
  }

  return res.json() as Promise<GoogleUserInfo>;
}
