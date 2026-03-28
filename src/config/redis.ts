import { Redis } from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,       // required by BullMQ
  enableOfflineQueue: false,        // fail fast instead of queuing when disconnected
  lazyConnect: true,                // don't auto-connect on instantiation
  retryStrategy: (times: number) => {
    if (times > 5) {
      console.warn('[Redis] Max retries reached — running without cache.');
      return null; // stop retrying
    }
    return Math.min(times * 200, 2000); // exponential back-off up to 2 s
  },
});

redisClient.on('error', (err) => {
  // Log but don't crash — app degrades gracefully without cache
  console.error('[Redis] Client error:', err.message ?? err);
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    await redisClient.ping();
    console.log(`[Redis] Connected at ${redisHost}:${redisPort}`);
  } catch (error: any) {
    // Warn only — the app will still serve requests via MongoDB
    console.warn('[Redis] Unavailable — continuing without cache:', error.message ?? error);
  }
};
