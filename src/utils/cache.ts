import { redisClient } from "../config/redis";

const DEFAULT_TTL = 60 * 5; // 5 minutes

// Retrieve a cached value. Returns parsed object or null on cache miss or error.
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redisClient.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null; // cache miss — caller will fall through to DB
  }
};

// Store a value in cache. Silently no-ops if Redis is unavailable.
export const setCache = async (
  key: string,
  value: unknown,
  ttl = DEFAULT_TTL,
): Promise<void> => {
  try {
    await redisClient.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    // no-op
  }
};

// Delete one or more specific cache keys. Silently no-ops if Redis is unavailable.
export const deleteCache = async (...keys: string[]): Promise<void> => {
  try {
    if (keys.length > 0) await redisClient.del(...keys);
  } catch {
    // no-op
  }
};

// Delete all keys matching a given pattern using non-blocking SCAN.
// Silently no-ops if Redis is unavailable.

export const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) await redisClient.del(...keys);
    } while (cursor !== "0");
  } catch {
    // no-op
  }
};
