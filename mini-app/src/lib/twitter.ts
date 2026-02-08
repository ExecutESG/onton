// lib/twitter.ts
import crypto from "node:crypto";

/* ------------------------------------------------------------------ */
/*                        tiny utility helpers                        */
/* ------------------------------------------------------------------ */
const base64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomUrlSafeString = (bytes = 32) => base64url(crypto.randomBytes(bytes));

const sha256base64url = (str: string) => base64url(crypto.createHash("sha256").update(str).digest());

/* ------------------------------------------------------------------ */
/*                      main makeAuthUrl() export                     */
/* ------------------------------------------------------------------ */
export function makeAuthUrl(): {
  url: string;
  codeVerifier: string;
  state: string;
} {
  // 1) PKCE bits
  const codeVerifier = randomUrlSafeString(64); // ≥ 43 chars
  const codeChallenge = sha256base64url(codeVerifier);

  // 2) CSRF protection
  const state = randomUrlSafeString(32);

  // 3) Build the authorize URL
  const authorizeUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.TWITTER_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/x/callback`);
  authorizeUrl.searchParams.set("scope", "tweet.read users.read");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  return {
    url: authorizeUrl.toString(),
    codeVerifier,
    state,
  };
}

// lib/twitter.ts  (add these below makeAuthUrl)

const TW_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const TW_ME_URL = "https://api.twitter.com/2/users/me";

/* ------------------------------------------------------------------ */
/*                   1)  code  →  access_token                        */
/* ------------------------------------------------------------------ */
function basicAuthHeader() {
  const token = `${process.env.TWITTER_CLIENT_ID!}:${process.env.TWITTER_CLIENT_SECRET!}`;
  return "Basic " + Buffer.from(token).toString("base64");
}

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.TWITTER_CLIENT_ID!, // still required
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/x/callback`,
    code,
    code_verifier: codeVerifier,
  });

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(), // ← NEW
    },
    body,
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Promise<{ access_token: string; refresh_token?: string }>;
}

/* ------------------------------------------------------------------ */
/*                   2)  access_token  →  /me                         */
/* ------------------------------------------------------------------ */
export interface XProfile {
  id: string;
  username: string;
  name: string; // display name
  profile_image_url?: string;
}

export async function fetchMe(accessToken: string): Promise<XProfile> {
  const url = new URL(TW_ME_URL);
  url.searchParams.set("user.fields", "profile_image_url");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fetching /me failed: ${res.status} ${errText}`);
  }

  const json = (await res.json()) as { data: XProfile };
  return json.data;
}
