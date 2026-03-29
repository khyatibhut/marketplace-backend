import { ConnectionOptions } from "bullmq";

export const redisQueueConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  family: 4, // Force IPv4 to avoid resolution errors
  maxRetriesPerRequest: null, 
};
