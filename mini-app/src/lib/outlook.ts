import crypto from "node:crypto";

const identityRoot = "https://login.microsoftonline.com/common/oauth2/v2.0";
const graphMe = "https://graph.microsoft.com/v1.0/me";

const base64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = () => base64url(crypto.randomBytes(32));
const sha256 = (str: string) => base64url(crypto.createHash("sha256").update(str).digest());

/* 1️⃣  generate URL + PKCE bits */
export function makeOutlookAuthUrl() {
  const codeVerifier = rand();
  const codeChallenge = sha256(codeVerifier);
  const state = rand();

  const u = new URL(`${identityRoot}/authorize`);
  u.searchParams.set("client_id", process.env.MS_CLIENT_ID!);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/outlook/callback`);
  u.searchParams.set("scope", "openid offline_access https://graph.microsoft.com/User.Read");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");

  return { url: u.toString(), codeVerifier, state };
}

/* 2️⃣  code ➜ tokens */
export async function exchangeCodeForMsToken(code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.MS_CLIENT_ID!,
    scope: "https://graph.microsoft.com/User.Read offline_access",
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/outlook/callback`,
    code_verifier: verifier,
    client_secret: process.env.MS_CLIENT_SECRET!, // confidential web‑back‑end
  });

  const r = await fetch(`${identityRoot}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) throw new Error(`token error ${r.status}`);
  return r.json() as Promise<{ access_token: string }>;
}

/* 3️⃣  access_token ➜ /me */
export async function fetchOutlookProfile(at: string) {
  const r = await fetch(graphMe, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) throw new Error(`graph /me ${r.status}`);
  return (await r.json()) as {
    id: string;
    displayName: string;
    givenName?: string;
    surname?: string;
    userPrincipalName?: string;
  };
}
