import { execFileSync } from "child_process";
import * as path from "path";
import { assertNotProduction, loadEnvTest } from "../helpers/envTest";

/**
 * Resets the persistent staging fixtures (registrations, visitors, rewards, reports)
 * so every run starts clean without creating new events.
 */
export default async function globalSetup(): Promise<void> {
  loadEnvTest();
  assertNotProduction();
  const output = execFileSync("bash", [path.resolve(__dirname, "reset-fixtures.sh")], {
    env: process.env,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (!output.includes("fixtures_reset|3") || !output.includes("redis_cache_cleared")) {
    throw new Error(`Fixture reset did not complete:\n${output}`);
  }
}
