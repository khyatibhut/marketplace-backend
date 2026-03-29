import { Queue } from "bullmq";
import { redisQueueConnection } from "../config/queue";
import { OrderStatus } from "../models/Order";

import { isRedisConnected } from "../config/redis";

let orderLifecycleQueue: Queue;

export const getOrderLifecycleQueue = () => {
  if (!isRedisConnected) return null;
  if (!orderLifecycleQueue) {
    orderLifecycleQueue = new Queue("order-lifecycle", {
      connection: redisQueueConnection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
    });
  }
  return orderLifecycleQueue;
};

export const addOrderLifecycleJob = async (
  orderId: string,
  nextStatus: OrderStatus,
  delayMs: number,
) => {
  const queue = getOrderLifecycleQueue();
  if (!queue) return null;

  const job = await queue.add(
    "transition-status",
    { orderId, nextStatus },
    { delay: delayMs },
  );
  return job.id;
};

export const removeOrderJob = async (jobId: string) => {
  try {
    const queue = getOrderLifecycleQueue();
    if (!queue) return;

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch (err) {
    console.error(`Failed to remove job ${jobId}`, err);
  }
};
