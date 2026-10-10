import { getRedisClient } from "./redisClient"; // Use getRedisClient to ensure a valid Redis client
import { logger } from "../utils/logger";

const CACHE_ENABLED = process.env.CACHE_ENABLED
  ? process.env.CACHE_ENABLED.toLowerCase() === "true"
  : true;
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
export const setCache = async (
  key: string,
  value: any,
  ttl?: number,
): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    const serializedValue = JSON.stringify(value); // Redis stores as string, so we serialize
    await redisClient.set(key, serializedValue);
    if (ttl !== undefined) {
      await redisClient.expire(key, ttl);
    }
  } catch (err) {
    logger.error(`Error setting cache for key ${key}:`, err);
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
    // logger.log(`Cache for key ${key}`);
    return result ? JSON.parse(result) : undefined; // Deserialize the value from Redis
  } catch (err) {
    logger.error(`Error getting cache for key ${key}:`, err);
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
    logger.log("deleted_key", key);
  } catch (err) {
    logger.error(`Error deleting cache for key ${key}:`, err);
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
    logger.error(`Error checking if key ${key} exists:`, err);
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
export const setRedisKeyJson = async (
  key: string,
  value: any,
  ttl?: number,
): Promise<void> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    await redisClient.json.set(key, "$", value);
    if (ttl !== undefined) {
      await redisClient.expire(key, ttl);
    }
  } catch (err) {
    logger.error(`Error setting JSON value for key ${key}:`, err);
  }
};

/**
 * Gets a JSON value from Redis cache.
 *
 * @param key - The cache key.
 * @returns The cached JSON value or undefined if not found.
 */
export const getRedisKeyJson = async (
  key: string,
): Promise<any | undefined> => {
  if (!CACHE_ENABLED) return;

  try {
    const redisClient = await getRedisClient();
    return await redisClient.json.get(key);
  } catch (err) {
    logger.error(`Error getting JSON value for key ${key}:`, err);
    return undefined;
  }
};

/**
 * Gets the type of  key in Redis.
 *
 * @param key - The cache key.
 * @returns The type of the key.
 */
export const getRedisKeyType = async (
  key: string,
): Promise<string | undefined> => {
  if (!CACHE_ENABLED) return undefined;

  try {
    const redisClient = await getRedisClient();
    return await redisClient.type(key);
  } catch (err) {
    logger.error(`Error getting type for key ${key}:`, err);
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
    logger.error(`Error incrementing key ${key}:`, err);
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
    logger.error(`Error decrementing key ${key}:`, err);
  }
};

/**
 * Get the TTL of a key in Redis.
 *
 * @param key - The cache key.
 * @returns The TTL in seconds, or -1 if the key does not expire, or -2 if the key does not exist.
 */
export const getRedisKeyTTL = async (
  key: string,
): Promise<number | undefined> => {
  if (!CACHE_ENABLED) return undefined;

  try {
    const redisClient = await getRedisClient();
    return await redisClient.ttl(key);
  } catch (err) {
    logger.error(`Error getting TTL for key ${key}:`, err);
    return undefined;
  }
};

/**
 * Set the TTL of a key in Redis.
 *
 * @param key - The cache key.
 * @param ttl - The TTL in seconds.
 */
export const setRedisKeyTTL = async (
  key: string,
  ttl: number,
): Promise<void> => {
  if (!CACHE_ENABLED) return undefined;

  try {
    const redisClient = await getRedisClient();
    await redisClient.expire(key, ttl);
  } catch (err) {
    logger.error(`Error setting TTL for key ${key}:`, err);
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
    logger.error(`Error persisting key ${key}:`, err);
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
    logger.log("Redis connection closed");
  } catch (err) {
    logger.error("Error closing Redis connection:", err);
  }
};

/**
 * Connect to Redis.
 */
export const connectRedis = async (): Promise<void> => {
  if (!CACHE_ENABLED) return;
  try {
    await getRedisClient();
    logger.log("Connected to Redis");
  } catch (err) {
    logger.error("Error connecting to Redis:", err);
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
  hubs: "onton:hubs",
  event_uuid: "event_uuid:",
  event_id: "event_id:",
};
export const cacheLvl = {
  guard: 60, // 1 minutes
  short: 60 * 10, // 5 minutes
  medium: 60 * 60 * 2, // 2 hour
  long: 60 * 60 * 24, // 1 day
  authApiOtpTimeout: 60 * 5, // 5 minutes
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
  cacheKeys,
  cacheLvl,
};
