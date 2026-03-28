import { Redis } from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null, // necessary for BullMQ
});

redisClient.on('error', (err) => {
  console.error('Redis client error:', err);
});

export const connectRedis = async () => {
  try {
    await redisClient.ping();
    console.log(`Successfully connected to Redis at ${redisHost}:${redisPort}`);
  } catch (error) {
    console.error('Error connecting to Redis:', error);
    process.exit(1);
  }
};
