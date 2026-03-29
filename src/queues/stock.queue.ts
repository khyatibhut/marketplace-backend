import { Queue } from "bullmq";
import { redisQueueConnection } from "../config/queue";

import { isRedisConnected } from "../config/redis";

let stockUpdateQueue: Queue;

export const getStockUpdateQueue = () => {
  if (!isRedisConnected) return null;
  if (!stockUpdateQueue) {
    stockUpdateQueue = new Queue("stock-update", {
      connection: redisQueueConnection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
    });
  }
  return stockUpdateQueue;
};

export const addStockRestoreJob = async (
  orderId: string,
  items: { productId: string; quantity: number }[],
) => {
  const queue = getStockUpdateQueue();
  if (!queue) return null;

  const job = await queue.add("restore", { orderId, items });
  return job.id;
};
