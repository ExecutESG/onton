// lib/github.ts  – confidential‑client version (no PKCE)
import crypto from "node:crypto";

/* ---------------- endpoints ---------------- */
const GH_AUTH = "https://github.com/login/oauth/authorize";
const GH_TOKEN = "https://github.com/login/oauth/access_token";
const GH_USER = "https://api.github.com/user";

/* ---------------- 1. build authorize URL ---------------- */
export function makeGithubAuthUrl(): { url: string; state: string } {
  const state = crypto.randomBytes(32).toString("hex");

  const u = new URL(GH_AUTH);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  u.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/gh/callback`);
  u.searchParams.set("scope", "read:user user:email");
  u.searchParams.set("state", state);

  return { url: u.toString(), state };
}

/* ---------------- 2. code → access_token ---------------- */
export async function exchangeCodeForTokenGithub(code: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/gh/callback`,
  });

  /* Basic‑auth header with client_id:client_secret */
  const basic = Buffer.from(`${process.env.GITHUB_CLIENT_ID!}:${process.env.GITHUB_CLIENT_SECRET!}`).toString("base64");

  const res = await fetch(GH_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!res.ok) throw new Error(`GitHub token error ${await res.text()}`);
  return res.json() as Promise<{ access_token: string }>;
}

/* ---------------- 3. fetch profile ---------------- */
export interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export async function fetchGithubUser(accessToken: string): Promise<GithubProfile> {
  const res = await fetch(GH_USER, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GitHub /user error ${await res.text()}`);
  return res.json() as Promise<GithubProfile>;
}
