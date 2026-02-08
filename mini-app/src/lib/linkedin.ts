// lib/linkedin.ts
import { randomBytes } from "node:crypto";

/* ------------------------------------------------------------------ */
/*                        Endpoint constants                          */
/* ------------------------------------------------------------------ */
const LINKEDIN_AUTH = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO = "https://api.linkedin.com/v2/userinfo"; // OIDC endpoint

/* ------------------------------------------------------------------ */
/*                     1.  Authorize‑URL builder                      */
/* ------------------------------------------------------------------ */
const randomState = () => randomBytes(32).toString("hex");

/**
 * Returns the URL the browser should visit and the opaque state string
 * you’ll store in Redis for CSRF protection.
 */
export function makeLinkedinAuthUrl(): { url: string; state: string } {
  const state = randomState();

  const u = new URL(LINKEDIN_AUTH);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  u.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/li/callback`);
  /** OIDC scopes (profile + email) */
  u.searchParams.set("scope", "openid profile email");
  u.searchParams.set("state", state);

  return { url: u.toString(), state };
}

/* ------------------------------------------------------------------ */
/*              2.  Exchange code  →  access_token (+ id_token)       */
/* ------------------------------------------------------------------ */
export async function exchangeCodeForTokenLinkedin(code: string): Promise<{
  access_token: string;
  id_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/li/callback`,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!, // always required
  });

  const res = await fetch(LINKEDIN_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`LinkedIn token error ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*                    3.  Standard OIDC userinfo                      */
/* ------------------------------------------------------------------ */
export interface LinkedinUserInfo {
  sub: string; // member ID
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

export async function fetchLinkedinUserInfo(accessToken: string): Promise<LinkedinUserInfo> {
  const res = await fetch(LINKEDIN_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`LinkedIn userinfo error ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<LinkedinUserInfo>;
}
