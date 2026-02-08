import { db } from "@/db/db";
import { ontoSetting } from "@/db/schema";
import { eq } from "drizzle-orm";

import { cacheKeys, getCache, setCache } from "@/lib/redisTools";

type Environment = "development" | "production" | "staging" | "local";

export async function fetchOntonSettings() {
  // Try to fetch non-protected settings from cache
  const cachedConfig = await getCache(cacheKeys.ontonSettings);
  const cachedConfigProtected = await getCache(cacheKeys.ontonSettingsProtected);

  // If both configurations are cached, return them immediately
  if (cachedConfig && cachedConfigProtected) {
    return { config: cachedConfig, configProtected: cachedConfigProtected };
  }

  let config: { [key: string]: string | object | null } = {};
  let configProtected: { [key: string]: string | object | null } = {};

  // Validate ENV value
  if (!["development", "production", "staging", "local"].includes(process.env.ENV!)) {
    throw new Error("Invalid ENV");
  }
  const env = process.env.ENV as Environment;

  const settings = await db.select().from(ontoSetting).where(eq(ontoSetting.env, env)).execute();

  // Helper function to parse JSON safely
  const tryParseJSON = (value: string | null): string | object | null => {
    if (!value) return value;
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as is if not valid JSON
    }
  };

  // Categorize settings based on the protected flag
  settings.forEach((setting) => {
    const key = `${setting.var}`;
    const parsedValue = tryParseJSON(setting.value);
    if (setting.protected === true) {
      configProtected[key] = parsedValue;
    } else {
      config[key] = parsedValue;
    }
  });

  // Cache the results separately
  await setCache(cacheKeys.ontonSettings, config, 600);
  await setCache(cacheKeys.ontonSettingsProtected, configProtected, 600);

  return { config, configProtected };
}
