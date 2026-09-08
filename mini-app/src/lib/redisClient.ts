import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | undefined;

const connectToRedis = async (): Promise<void> => {
  if (!redisClient) {
    const redisPassword = process.env.REDIS_PASSWORD;
    const authString = redisPassword ? `:${redisPassword}@` : "";
    redisClient = createClient({
      url: `redis://${authString}${process.env.IP_REDIS || "redis"}:${process.env.REDIS_PORT || 6379}`,
    });

    redisClient.on("error", (err) => {
      process.env.NODE_ENV !== "development" && console.error("Redis error:", err);
    });

    redisClient.on("connect", () => {
      process.env.NODE_ENV !== "development" && console.log("Connected to Redis");
    });

    await redisClient.connect();
  }
};

// This function guarantees that redisClient is never undefined
export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient) {
    await connectToRedis();
  }

  if (!redisClient) {
    throw new Error("Redis client initialization failed");
  }

  return redisClient;
};
