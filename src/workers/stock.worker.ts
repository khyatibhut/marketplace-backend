import { Worker, Job } from "bullmq";
import { redisQueueConnection } from "../config/queue";
import { Product } from "../models/Product";
import { deleteCache } from "../utils/cache";
import mongoose from "mongoose";

export const initStockWorker = () => {
  const worker = new Worker(
    "stock-update",
    async (job: Job) => {
      const { orderId, items } = job.data;
      if (!items || !items.length) return;

      console.log(
        `[Stock Worker] Processing stock restoration for cancelled order ${orderId}`,
      );

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await Promise.all([
          ...items.map((item: any) =>
            Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: item.quantity } },
              { session },
            ),
          ),
          deleteCache(...items.map((item: any) => `stock:${item.productId}`)),
        ]);

        await session.commitTransaction();
        console.log(
          `[Stock Worker] Successfully restored stock for order ${orderId}`,
        );
      } catch (err) {
        await session.abortTransaction();
        console.error(
          `[Stock Worker] DB Transaction failed restoring stock for ${orderId}`,
          err,
        );
        throw err;
      } finally {
        session.endSession();
      }
    },
    { connection: redisQueueConnection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Stock Worker] Job ${job?.id} failed to update stock`, err);
  });

  return worker;
};
