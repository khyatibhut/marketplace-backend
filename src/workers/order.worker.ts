import { Worker, Job } from "bullmq";
import { redisQueueConnection } from "../config/queue";
import { Order, OrderStatus } from "../models/Order";
import { addOrderLifecycleJob } from "../queues/order.queue";
import { getIO } from "../sockets";
import { getCache, deleteCache, deleteCacheByPattern } from "../utils/cache";
import { triggerWebhooks } from "../services/webhook.service";

const NEXT_STATUS_MAP: Record<OrderStatus, OrderStatus | null> = {
  [OrderStatus.PLACED]: OrderStatus.CONFIRMED,
  [OrderStatus.CONFIRMED]: OrderStatus.PREPARING,
  [OrderStatus.PREPARING]: OrderStatus.OUT_FOR_DELIVERY,
  [OrderStatus.OUT_FOR_DELIVERY]: OrderStatus.DELIVERED,
  [OrderStatus.DELIVERED]: null,
  [OrderStatus.CANCELLED]: null,
};

// Auto-transition delays in MS
const DELAY_MAP: Record<OrderStatus, number> = {
  [OrderStatus.PLACED]: 2 * 60 * 1000,
  [OrderStatus.CONFIRMED]: 5 * 60 * 1000,
  [OrderStatus.PREPARING]: 10 * 60 * 1000,
  [OrderStatus.OUT_FOR_DELIVERY]: 15 * 60 * 1000,
  [OrderStatus.DELIVERED]: 0,
  [OrderStatus.CANCELLED]: 0,
};

export const initOrderWorker = () => {
  const worker = new Worker(
    "order-lifecycle",
    async (job: Job) => {
      const { orderId, nextStatus } = job.data;

      const order = await Order.findById(orderId);
      if (!order) {
        console.warn(`[Order Worker] Order ${orderId} not found. Skipping.`);
        return;
      }

      // Check if job is still the active one (prevent race conditions with manual overrides)
      if (order.currentJobId && order.currentJobId !== job.id) {
        console.warn(
          `[Order Worker] Job ${job.id} is obsolete for order ${orderId}. Skipping.`,
        );
        return;
      }

      // Prevent jumping if status has already progressed or cancelled
      if (
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.DELIVERED
      ) {
        return;
      }

      // Update Order Status
      order.status = nextStatus as OrderStatus;
      order.statusHistory.push({
        status: nextStatus as OrderStatus,
        timestamp: new Date(),
        comment: "Auto-updated by system",
      });

      // Compute next automatic step
      const futureStatus = NEXT_STATUS_MAP[nextStatus as OrderStatus];
      if (futureStatus) {
        const delayMs = DELAY_MAP[nextStatus as OrderStatus];
        const jobId = await addOrderLifecycleJob(
          order._id.toString(),
          futureStatus,
          delayMs,
        );
        order.currentJobId = jobId || undefined;
      } else {
        order.currentJobId = undefined;
      }

      await order.save();

      // Invalidate caches
      await deleteCache(
        `order:${orderId}:*`,
        `order:status:${orderId}`,
        "orders:statistics",
      );
      await deleteCacheByPattern(`orders:buyer:${order.buyerId}:*`);

      // Emit real-time events based on status
      const io = getIO();
      const statusStr = order.status;
      io.to(`user:${order.buyerId}`).emit("order:status_update", {
        orderId: order._id,
        status: statusStr,
      });
      order.sellerIds.forEach((sellerId: any) => {
        io.to(`seller:${sellerId}`).emit("seller:order_update", {
          orderId: order._id,
          status: statusStr,
        });
      });
      io.to("admin").emit("admin:order_update", {
        orderId: order._id,
        status: statusStr,
      });

      // Trigger Webhooks for Buyer and Sellers
      await triggerWebhooks(
        [order.buyerId.toString(), ...order.sellerIds.map((s) => s.toString())],
        "order.status_updated",
        { orderId: order._id, status: statusStr }
      );

      console.log(
        `[Order Worker] Successfully transitioned order ${orderId} to ${nextStatus}`
      );
    },
    { connection: redisQueueConnection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Order Worker] Job ${job?.id} failed:`, err);
  });

  return worker;
};
