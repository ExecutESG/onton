import * as fs from "fs";
import * as path from "path";

/**
 * Loads tests/e2e/.env.test into process.env without shell evaluation
 * (values such as mnemonics contain spaces and must never be shell-sourced).
 * Existing process.env values win.
 */
export function loadEnvTest(file: string = path.resolve(__dirname, "..", ".env.test")): void {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Returns a required env var or throws with a clear message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see tests/e2e/.env.test.example)`);
  return value;
}

/** Throws if the run targets production. */
export function assertNotProduction(): void {
  const baseUrl = process.env.BASE_URL ?? "";
  const host = baseUrl ? new URL(baseUrl).hostname : "";
  if (host === "app.onton.live" || host === "onton.live") {
    throw new Error(`FATAL: BASE_URL ${baseUrl} is production. The real suite only runs on staging.`);
  }
  if ((process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").replace(/^@/, "") === "theontonbot") {
    throw new Error("FATAL: bot is @theontonbot (production). The real suite only runs on staging.");
  }
  if ((process.env.E2E_STAGING_SSH ?? "").includes("65.109.212.86")) {
    throw new Error("FATAL: E2E_STAGING_SSH points to the production host.");
  }
}
