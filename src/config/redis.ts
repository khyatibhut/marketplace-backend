import { Redis } from 'ioredis';

const redisHostRaw = process.env.REDIS_HOST || '127.0.0.1';
const redisHost = redisHostRaw === 'localhost' ? '127.0.0.1' : redisHostRaw;
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  family: 4,                        // Force IPv4 to avoid resolution errors
  maxRetriesPerRequest: 10,         // Fail fast for cache operations
  enableOfflineQueue: false,        // fail fast instead of queuing when disconnected
  lazyConnect: true,                // don't auto-connect on instantiation
  retryStrategy: (times: number) => {
    if (times > 5) {
      if (times === 6) console.warn('[Redis] Max retries reached — running without cache.');
      return null; // stop retrying
    }
    return Math.min(times * 200, 2000); // exponential back-off up to 2 s
  },
});

export let isRedisConnected = false;

redisClient.on('error', (err) => {
  // Silence connection errors once we know Redis is unavailable
  if (!isRedisConnected && err.message.includes('ECONNREFUSED')) return;

  if (err.name === 'AggregateError') {
    console.error('[Redis] AggregateError — multiple connection attempts failed');
  } else {
    console.error('[Redis] Client error:', err.message ?? err);
  }
});

export const connectRedis = async (): Promise<boolean> => {
  try {
    await redisClient.connect();
    await redisClient.ping();
    isRedisConnected = true;
    console.log(`[Redis] Connected at ${redisHost}:${redisPort}`);
    return true;
  } catch (error: any) {
    isRedisConnected = false;
    let errorMessage = error.message ?? error;
    if (error.name === 'AggregateError' && Array.isArray(error.errors)) {
      errorMessage = `AggregateError (${error.errors.length} failures): ${error.errors[0]?.message || 'Unknown'}`;
    }
    console.warn(`[Redis] Unavailable at ${redisHost}:${redisPort} — background tasks disabled:`, errorMessage);
    return false;
  }
};
