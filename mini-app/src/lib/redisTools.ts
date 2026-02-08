import { getRedisClient } from "./redisClient"; // Use getRedisClient to ensure a valid Redis client

const CACHE_ENABLED = process.env.CACHE_ENABLED ? process.env.CACHE_ENABLED.toLowerCase() === "true" : true;
/**
 * Generates an MD5 hash for a given key.
 *
 * @param key - The input key.
 * @returns The MD5 hash of the key.
 */

/**
 * Sets a value in Redis cache.
 *
 * @param key - The cache key.
 * @param value - The value to store.
 * @param ttl - Optional time-to-live for this specific cache entry (in seconds).
 */
export const setCache = async (key: string, value: any, ttl?: number): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    const serializedValue = JSON.stringify(value); // Redis stores as string, so we serialize
    await redisClient.set(key, serializedValue);
    if (ttl !== undefined) {
      await redisClient.expire(key, ttl);
    }
  } catch (err) {
    console.error(`Error setting cache for key ${key}:`, err);
  }
};

/**
 * Gets a value from Redis cache.
 *
 * @param key - The cache key.
 * @returns The cached value or undefined if not found.
 */
export const getCache = async (key: string): Promise<any | undefined> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    const result = await redisClient.get(key);
    // console.log(`Cache for key ${key}`);
    return result ? JSON.parse(result) : undefined; // Deserialize the value from Redis
  } catch (err) {
    console.error(`Error getting cache for key ${key}:`, err);
    return undefined;
  }
};

/**
 * Deletes a value from Redis cache.
 *
 * @param key - The cache key.
 */
export const deleteCache = async (key: string): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    await redisClient.del(key);
  } catch (err) {
    console.error(`Error deleting cache for key ${key}:`, err);
  }
};

/**
 * Check if a key exists in Redis.
 *
 * @param key - The cache key.
 * @returns A boolean indicating whether the key exists.
 */
export const keyExists = async (key: string): Promise<boolean> => {
  if (!CACHE_ENABLED) return false;

  try {
    const redisClient = await getRedisClient();
    const exists = await redisClient.exists(key);
    return exists === 1;
  } catch (err) {
    console.error(`Error checking if key ${key} exists:`, err);
    return false;
  }
};

/**
 * Sets a JSON value in Redis cache.
 *
 * @param key - The cache key.
 * @param value - The value to store (as JSON).
 * @param ttl - Optional time-to-live for this specific cache entry.
 */
export const setRedisKeyJson = async (key: string, value: any, ttl?: number): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    await redisClient.json.set(key, "$", value);
    if (ttl !== undefined) {
      await redisClient.expire(key, ttl);
    }
  } catch (err) {
    console.error(`Error setting JSON value for key ${key}:`, err);
  }
};

/**
 * Gets a JSON value from Redis cache.
 *
 * @param key - The cache key.
 * @returns The cached JSON value or undefined if not found.
 */
export const getRedisKeyJson = async (key: string): Promise<any | undefined> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    return await redisClient.json.get(key);
  } catch (err) {
    console.error(`Error getting JSON value for key ${key}:`, err);
    return undefined;
  }
};

/**
 * Gets the type of  key in Redis.
 *
 * @param key - The cache key.
 * @returns The type of the key.
 */
export const getRedisKeyType = async (key: string): Promise<string | undefined> => {
  if (!CACHE_ENABLED) return undefined;

  try {
    const redisClient = await getRedisClient();
    return await redisClient.type(key);
  } catch (err) {
    console.error(`Error getting type for key ${key}:`, err);
    return undefined;
  }
};

/**
 * Increment a key's value in Redis.
 *
 * @param key - The cache key.
 */
export const incrementKey = async (key: string): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    await redisClient.incr(key);
  } catch (err) {
    console.error(`Error incrementing key ${key}:`, err);
  }
};

/**
 * Decrement a key's value in Redis.
 *
 * @param key - The cache key.
 */
export const decrementKey = async (key: string): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    await redisClient.decr(key);
  } catch (err) {
    console.error(`Error decrementing key ${key}:`, err);
  }
};

/**
 * Get the TTL of a key in Redis.
 *
 * @param key - The cache key.
 * @returns The TTL in seconds, or -1 if the key does not expire, or -2 if the key does not exist.
 */
export const getRedisKeyTTL = async (key: string): Promise<number | undefined> => {
  if (!CACHE_ENABLED) return undefined;

  try {
    const redisClient = await getRedisClient();
    return await redisClient.ttl(key);
  } catch (err) {
    console.error(`Error getting TTL for key ${key}:`, err);
    return undefined;
  }
};

/**
 * Set the TTL of a key in Redis.
 *
 * @param key - The cache key.
 * @param ttl - The TTL in seconds.
 */
export const setRedisKeyTTL = async (key: string, ttl: number): Promise<void> => {
  if (!CACHE_ENABLED) return undefined;

  try {
    const redisClient = await getRedisClient();
    await redisClient.expire(key, ttl);
  } catch (err) {
    console.error(`Error setting TTL for key ${key}:`, err);
  }
};

/**
 * Persist a key in Redis (remove the TTL).
 *
 * @param key - The cache key.
 */
export const persistKey = async (key: string): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    await redisClient.persist(key);
  } catch (err) {
    console.error(`Error persisting key ${key}:`, err);
  }
};

/**
 * Quit the Redis connection.
 */
export const quitRedis = async (): Promise<void> => {
  if (!CACHE_ENABLED) return;
  try {
    const redisClient = await getRedisClient();
    await redisClient.quit();
    console.log("Redis connection closed");
  } catch (err) {
    console.error("Error closing Redis connection:", err);
  }
};

/**
 * Connect to Redis.
 */
export const connectRedis = async (): Promise<void> => {
  if (!CACHE_ENABLED) return;
  try {
    await getRedisClient();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Error connecting to Redis:", err);
  }
};
/**
 * Acquires a lock using Redis SET NX EX pattern.
 *
 * @param lockKey - The key used for locking
 * @param ttl - The lock time-to-live in seconds
 * @returns true if lock is acquired, false otherwise
 */
export const acquireLock = async (lockKey: string, ttl: number): Promise<boolean> => {
  if (!CACHE_ENABLED) return true; // If cache is disabled, we "simulate" a lock success

  try {
    const redisClient = await getRedisClient();
    // NX => Only set if key doesn't exist
    // EX => Expire the key after <ttl> seconds
    const result = await redisClient.set(lockKey, "locked", { NX: true, EX: ttl });
    // result === "OK" => lock acquired; null => lock not acquired
    return result === "OK";
  } catch (err) {
    console.error(`Error acquiring lock for key ${lockKey}:`, err);
    // Fall back to false => can't acquire lock
    return false;
  }
};

/**
 * Releases a lock by deleting the given lock key.
 *
 * @param lockKey - The key to unlock
 */
export const releaseLock = async (lockKey: string): Promise<void> => {
  if (!CACHE_ENABLED) return;
  try {
    const redisClient = await getRedisClient();
    await redisClient.del(lockKey);
  } catch (err) {
    console.error(`Error releasing lock for key ${lockKey}:`, err);
  }
};
/**
 * Cache keys
 */
export const cacheKeys = {
  getEventsWithFilters: `getEventsWithFilters:`,
  cronJobLock: "cronJobLock:",
  ontonSettings: "ontonSettings:",
  ontonSettingsProtected: "ontonSettingsProtected:",
  city: "city:",
  country: "country:",
  user: "user:",
  userWallet: "userWallet:",
  visitor: "visitor:",
  visitorWithWallet: "visitorWithWallet:",
  visitorUserAndEventUuid: "visitorUserAndEventUuid:",
  reward: "reward:",
  authApiOtp: "auth:api:otp:",
  jwtBlacklist: "auth:jwt:blacklist:",
  SBTRewardCollections: "SBTRewardCollections:",
  SBTRewardCollectionByHubID: "SBTRewardCollections:hubID:",
  eventPoaTrigger: "eventPoaTrigger:",
  eventPoaByEvent: "eventPoaByEvent:",
  notification: "notification:",
  notificationsByStatus: "notificationsByStatus:",
  eventPoaResult: "eventPoaResult:",
  eventPoaResultsByEvent: "eventPoaResultsByEvent:",
  user_flags: "user_flags:",
  hubs: "ton-society:hubs",
  user_roles: "user_roles:",
  event_uuid: "event_uuid:",
  event_id: "event_id:",
  dynamic_fields: "dynamic_fields:event_id:",
  join_task_tg_ch: "join_task_tg_ch:", // channel
  join_task_tg_gp: "join_task_tg_gp:", // group
  usersScore: "usersScore:",
  rateLimitRequestApi: "rate-limit-request-api:",
  callbackTask: "callbackTask:",
  affiliateLinkById: "affiliateLinkById:",
  getTournamentsWithFilters: "getTournamentsWithFilters:",
  elympicsMasterJwt: "elympicsMasterJwt:",
  leaderboard: "leaderboard:",
  getTournamentById: "getTournamentById:",
  gameIds: "gameIds",
  getTournamentsByIds: "getTournamentsByIds:",
  category_id: "category_id:",
  category_uuid: "category_uuid:",
  event_wallet_event_id: "event_wallet_event_id:",
  userX: "userX:", // X account for a Telegram user
  userXByXId: "userXByXId:", // X user‑id to Telegram user‑id mapping
  userGithub: "userGithub:", // GitHub account for a Telegram user
  userGithubById: "userGithubById:", // GitHub user‑id to Telegram user‑id mapping
  userLinkedin: "userLinkedin:", // LinkedIn account for a Telegram user
  userLinkedinById: "userLinkedinById:", // LinkedIn user‑id to Telegram user‑id mapping
  userGoogle: "userGoogle:", // Google account for a Telegram user
  userGoogleByGId: "userGoogleByGId:", // Google user‑id to Telegram user‑id mapping
  userOutlook: "userOutlook:", // Outlook account for a Telegram user
  userOutlookByMsId: "userOutlookById:", // Outlook user‑id to Telegram user‑id mapping
};
export const cacheLvl = {
  guard: 60, // 1 minutes
  short: 60 * 10, // 5 minutes
  medium: 60 * 60 * 2, // 2 hour
  long: 60 * 60 * 24, // 1 day
  extraLong: 60 * 60 * 24 * 30, //  30 days
  authApiOtpTimeout: 60 * 5, // 5 minutes
} as const;
export const rQueues = {
  CLICK_QUEUE_KEY: "affiliate_clicks_queue",
};
// Export all the functions in one object as well
export const redisTools = {
  setCache,
  getCache,
  deleteCache,
  keyExists,
  setRedisKeyJson,
  getRedisKeyJson,
  getRedisKeyType,
  incrementKey,
  decrementKey,
  getRedisKeyTTL,
  setRedisKeyTTL,
  persistKey,
  quitRedis,
  connectRedis,
  acquireLock,
  releaseLock,
  cacheKeys,
  cacheLvl,
  rQueues,
};
