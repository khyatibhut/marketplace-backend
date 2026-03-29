import { Request, Response } from "express";
import mongoose from "mongoose";
import { sendSuccess, sendError } from "../utils/response";
import { Order, OrderStatus } from "../models/Order";
import { Product } from "../models/Product";
import { getPagination } from "../utils/common";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../utils/validators";
import {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
} from "../utils/cache";
import { getIO } from "../sockets";
import { isRedisConnected } from "../config/redis";
import { addOrderLifecycleJob, removeOrderJob } from "../queues/order.queue";
import { addStockRestoreJob } from "../queues/stock.queue";

// Statuses a buyer can still cancel from
const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
];

// Valid seller-allowed status transitions (forward only, no skipping to delivered/cancelled)
const SELLER_ALLOWED_TRANSITIONS: Record<string, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING],
  [OrderStatus.PREPARING]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
};

// Cache key builders
const ORDER_KEY = (id: string) => `order:${id}`;
const ORDER_STATUS_KEY = (id: string) => `order:status:${id}`;
const BUYER_ORDERS_KEY = (buyerId: string, qs: string) =>
  `orders:buyer:${buyerId}:${qs}`;
const STATS_KEY = () => `orders:statistics`;

/**
 * Invalidate buyer-facing and stats caches on writes.
 * Seller/admin reads are not cached so no need to bust them.
 */
const invalidateOrderCaches = async (orderId?: string, buyerId?: string) => {
  const tasks: Promise<void>[] = [deleteCache(STATS_KEY())];
  if (orderId)
    tasks.push(
      deleteCache(ORDER_KEY(orderId)),
      deleteCache(ORDER_STATUS_KEY(orderId)),
    );
  if (buyerId) tasks.push(deleteCacheByPattern(`orders:buyer:${buyerId}:*`));
  await Promise.all(tasks);
};

// BUYER
export const createOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, shippingAddress } = createOrderSchema.parse(req.body);

    // Bulk-fetch all products
    const productIds = items.map(
      (i) => new mongoose.Types.ObjectId(i.productId),
    );
    const products = await Product.find({ _id: { $in: productIds } }).session(
      session,
    );
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let totalAmount = 0;
    const orderItems: {
      productId: mongoose.Types.ObjectId;
      quantity: number;
      pricePerItem: number;
    }[] = [];
    const sellerSet = new Set<string>();
    const stockUpdates: { id: mongoose.Types.ObjectId; delta: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        await session.abortTransaction();
        return sendError(res, 404, `Product not found: ${item.productId}`);
      }
      if (product.stock < item.quantity) {
        await session.abortTransaction();
        return sendError(
          res,
          409,
          `Insufficient stock for "${product.name}" (available: ${product.stock})`,
        );
      }
      totalAmount += product.price * item.quantity;
      orderItems.push({
        productId: product._id as mongoose.Types.ObjectId,
        quantity: item.quantity,
        pricePerItem: product.price,
      });
      sellerSet.add(product.sellerId.toString());
      stockUpdates.push({
        id: product._id as mongoose.Types.ObjectId,
        delta: -item.quantity,
      });
    }

    // Reduce stock for all products
    const stockPromises = stockUpdates.map(async ({ id, delta }) => {
      const updated = await Product.findOneAndUpdate(
        { _id: id, stock: { $gte: Math.abs(delta) } },
        { $inc: { stock: delta } },
        { session },
      );
      if (!updated) {
        throw new Error(
          "Stock unavailable or insufficient (preventing overselling)",
        );
      }
      return updated;
    });

    await Promise.all([
      ...stockPromises,
      deleteCache(...stockUpdates.map(({ id }) => `stock:${id}`)),
    ]);

    const [order] = await Order.create(
      [
        {
          buyerId: req.user.id,
          sellerIds: Array.from(sellerSet),
          items: orderItems,
          totalAmount: Number(totalAmount.toFixed(2)),
          shippingAddress,
          status: OrderStatus.PLACED,
          statusHistory: [
            { status: OrderStatus.PLACED, timestamp: new Date() },
          ],
        },
      ],
      { session },
    );

    await session.commitTransaction();

    // Schedule initial queue transition logic (if Redis is available)
    if (isRedisConnected) {
      const AUTO_DELAY_MS = 2 * 60 * 1000;
      const jobId = await addOrderLifecycleJob(
        order._id.toString(),
        OrderStatus.CONFIRMED,
        AUTO_DELAY_MS,
      );
      if (jobId)
        await Order.findByIdAndUpdate(order._id, { currentJobId: jobId });
    }

    await invalidateOrderCaches(undefined, req.user.id);

    // Broadcast new order to user and responsible sellers
    const io = getIO();
    io.to(`user:${req.user.id}`).emit("order:new", { order });
    order.sellerIds.forEach((sellerId: any) => {
      io.to(`seller:${sellerId}`).emit("seller:new_order", { order });
    });

    sendSuccess(res, 201, "Order placed successfully", { order });
  } catch (error: any) {
    await session.abortTransaction();
    if (error.name === "ZodError")
      return sendError(res, 400, "Validation error", error.errors);
    sendError(res, 500, "Error placing order", error.message);
  } finally {
    session.endSession();
  }
};

export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const { skip, limit, paginate } = getPagination(req);
    const cacheKey = BUYER_ORDERS_KEY(
      req.user.id,
      new URLSearchParams(req.query as any).toString(),
    );

    const cached = await getCache(cacheKey);
    if (cached)
      return sendSuccess(
        res,
        200,
        "Orders fetched successfully (cached)",
        cached,
      );

    const [orders, total] = await Promise.all([
      Order.find({ buyerId: req.user.id })
        .populate("items.productId", "name images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ buyerId: req.user.id }),
    ]);

    const payload = { orders, pagination: paginate(total) };
    await setCache(cacheKey, payload);
    sendSuccess(res, 200, "Orders fetched successfully", payload);
  } catch (error: any) {
    sendError(res, 500, "Error fetching orders", error.message);
  }
};

export const getOrderDetails = async (req: Request, res: Response) => {
  try {
    const cacheKey = ORDER_KEY(`${req.params.id}:buyer:${req.user.id}`);

    const cached = await getCache(cacheKey);
    if (cached)
      return sendSuccess(
        res,
        200,
        "Order details fetched successfully (cached)",
        { order: cached },
      );

    const order = await Order.findOne({
      _id: req.params.id,
      buyerId: req.user.id,
    })
      .populate("items.productId", "name images price")
      .populate("sellerIds", "name")
      .lean();

    if (!order) return sendError(res, 404, "Order not found");

    await setCache(cacheKey, order, 300); // 5 min TTL
    sendSuccess(res, 200, "Order details fetched successfully", { order });
  } catch (error: any) {
    sendError(res, 500, "Error fetching order details", error.message);
  }
};

export const getOrderStatus = async (req: Request, res: Response) => {
  try {
    const cacheKey = ORDER_STATUS_KEY(req.params.id);

    const cached = await getCache<{ status: string; statusHistory: unknown[] }>(
      cacheKey,
    );
    if (cached)
      return sendSuccess(
        res,
        200,
        "Order status fetched successfully (cached)",
        cached,
      );

    const order = await Order.findById(req.params.id)
      .select("status statusHistory currentJobId")
      .lean();

    if (!order) return sendError(res, 404, "Order not found");

    const payload = {
      status: order.status,
      statusHistory: order.statusHistory,
    };
    await setCache(cacheKey, payload, 60); // short TTL — status changes frequently
    sendSuccess(res, 200, "Order status fetched successfully", payload);
  } catch (error: any) {
    sendError(res, 500, "Error fetching order status", error.message);
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      buyerId: req.user.id,
    }).session(session);
    if (!order) {
      await session.abortTransaction();
      return sendError(res, 404, "Order not found");
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      await session.abortTransaction();
      return sendError(
        res,
        409,
        `Cannot cancel order in "${order.status}" status`,
      );
    }

    if (order.currentJobId && isRedisConnected) {
      await removeOrderJob(order.currentJobId);
      order.currentJobId = undefined;
    }

    order.status = OrderStatus.CANCELLED;
    order.statusHistory.push({
      status: OrderStatus.CANCELLED,
      timestamp: new Date(),
      comment: "Cancelled by buyer",
    });
    await order.save({ session });

    await session.commitTransaction();

    // Restore stock: async via queue if Redis available, synchronous fallback otherwise
    if (isRedisConnected) {
      await addStockRestoreJob(
        order._id.toString(),
        order.items.map((i) => ({
          productId: i.productId.toString(),
          quantity: i.quantity,
        })),
      );
    } else {
      // Synchronous fallback — restore stock directly
      await Promise.all([
        ...order.items.map((i) =>
          Product.findByIdAndUpdate(i.productId, {
            $inc: { stock: i.quantity },
          }),
        ),
        deleteCache(...order.items.map((i) => `stock:${i.productId}`)),
      ]);
    }
    await invalidateOrderCaches(req.params.id, order.buyerId.toString());

    // Broadcast cancelled status
    const io = getIO();
    io.to(`user:${order.buyerId}`).emit("order:cancelled", {
      orderId: order._id,
    });
    order.sellerIds.forEach((sellerId: any) => {
      io.to(`seller:${sellerId}`).emit("seller:order_update", {
        orderId: order._id,
        status: order.status,
      });
    });
    io.to("admin").emit("admin:order_update", {
      orderId: order._id,
      status: order.status,
      by: "buyer",
    });

    sendSuccess(res, 200, "Order cancelled successfully", { order });
  } catch (error: any) {
    await session.abortTransaction();
    sendError(res, 500, "Error cancelling order", error.message);
  } finally {
    session.endSession();
  }
};

// ─── SELLER ─────────────────────────────────────────────────────────────────

export const getSellerOrders = async (req: Request, res: Response) => {
  try {
    const { skip, limit, paginate } = getPagination(req);

    const filter: any = { sellerIds: req.user.id };
    if (req.query.status) filter.status = req.query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("buyerId", "name email")
        .populate("items.productId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    sendSuccess(res, 200, "Seller orders fetched successfully", {
      orders,
      pagination: paginate(total),
    });
  } catch (error: any) {
    sendError(res, 500, "Error fetching seller orders", error.message);
  }
};

export const getSellerOrderDetails = async (req: Request, res: Response) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      sellerIds: req.user.id,
    })
      .populate("buyerId", "name email")
      .populate("items.productId", "name price images")
      .lean();

    if (!order) return sendError(res, 404, "Order not found");

    sendSuccess(res, 200, "Order details fetched successfully", { order });
  } catch (error: any) {
    sendError(res, 500, "Error fetching order details", error.message);
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status, comment } = updateOrderStatusSchema.parse(req.body);

    const order = await Order.findOne({
      _id: req.params.id,
      sellerIds: req.user.id,
    });
    if (!order) return sendError(res, 404, "Order not found");

    const allowed = SELLER_ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status as OrderStatus)) {
      return sendError(
        res,
        409,
        `Cannot transition from "${order.status}" to "${status}"`,
      );
    }

    order.status = status as OrderStatus;
    order.statusHistory.push({
      status: status as OrderStatus,
      timestamp: new Date(),
      comment,
    });

    if (order.currentJobId && isRedisConnected) {
      await removeOrderJob(order.currentJobId);
      order.currentJobId = undefined;
    }

    await order.save();

    await invalidateOrderCaches(req.params.id, order.buyerId.toString());

    // Broadcast status update
    const io = getIO();
    io.to(`user:${order.buyerId}`).emit("order:status_update", {
      orderId: order._id,
      status: order.status,
    });
    io.to("admin").emit("admin:order_update", {
      orderId: order._id,
      status: order.status,
      sellerId: req.user.id,
    });

    sendSuccess(res, 200, "Order status updated successfully", { order });
  } catch (error: any) {
    if (error.name === "ZodError")
      return sendError(res, 400, "Validation error", error.errors);
    sendError(res, 500, "Error updating order status", error.message);
  }
};

// ─── ADMIN ───────────────────────────────────────────────────────────────────

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { skip, limit, paginate } = getPagination(req);

    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.buyerId) filter.buyerId = req.query.buyerId;
    if (req.query.sellerId) filter.sellerIds = req.query.sellerId;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("buyerId", "name email")
        .populate("sellerIds", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    sendSuccess(res, 200, "All orders fetched successfully", {
      orders,
      pagination: paginate(total),
    });
  } catch (error: any) {
    sendError(res, 500, "Error fetching orders", error.message);
  }
};

export const adminUpdateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status, comment } = updateOrderStatusSchema.parse(req.body);

    const order = await Order.findById(req.params.id);
    if (!order) return sendError(res, 404, "Order not found");

    const statusOrder: Record<string, number> = {
      [OrderStatus.PLACED]: 0,
      [OrderStatus.CONFIRMED]: 1,
      [OrderStatus.PREPARING]: 2,
      [OrderStatus.OUT_FOR_DELIVERY]: 3,
      [OrderStatus.DELIVERED]: 4,
    };

    if (
      status !== OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED &&
      statusOrder[status] < statusOrder[order.status]
    ) {
      return sendError(
        res,
        409,
        `Admin override cannot move status backward from "${order.status}" to "${status}"`,
      );
    }

    // If cancelling, restore stock: async via queue if Redis available, synchronous fallback otherwise
    if (
      status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      if (isRedisConnected) {
        await addStockRestoreJob(
          order._id.toString(),
          order.items.map((i) => ({
            productId: i.productId.toString(),
            quantity: i.quantity,
          })),
        );
      } else {
        await Promise.all([
          ...order.items.map((i) =>
            Product.findByIdAndUpdate(i.productId, {
              $inc: { stock: i.quantity },
            }),
          ),
          deleteCache(...order.items.map((i) => `stock:${i.productId}`)),
        ]);
      }
    }

    order.status = status as OrderStatus;
    order.statusHistory.push({
      status: status as OrderStatus,
      timestamp: new Date(),
      comment: comment ?? "Admin override",
    });

    if (order.currentJobId && isRedisConnected) {
      await removeOrderJob(order.currentJobId);
      order.currentJobId = undefined;
    }

    await order.save();

    await invalidateOrderCaches(req.params.id, order.buyerId.toString());

    // Broadcast status update
    const io = getIO();
    io.to(`user:${order.buyerId}`).emit("order:status_update", {
      orderId: order._id,
      status: order.status,
    });
    order.sellerIds.forEach((sellerId: any) => {
      io.to(`seller:${sellerId}`).emit("seller:order_update", {
        orderId: order._id,
        status: order.status,
      });
    });

    sendSuccess(res, 200, "Order status force-updated successfully", { order });
  } catch (error: any) {
    if (error.name === "ZodError")
      return sendError(res, 400, "Validation error", error.errors);
    sendError(res, 500, "Error updating order status", error.message);
  }
};

export const resetStuckOrders = async (req: Request, res: Response) => {
  try {
    // Orders stuck in non-terminal, non-placed statuses for more than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stuckStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.OUT_FOR_DELIVERY,
    ];

    const result = await Order.updateMany(
      { status: { $in: stuckStatuses }, updatedAt: { $lt: cutoff } },
      {
        $set: { status: OrderStatus.PLACED },
        $push: {
          statusHistory: {
            status: OrderStatus.PLACED,
            timestamp: new Date(),
            comment: "Auto-reset by admin: order was stuck",
          },
        },
      },
    );

    // Bust all order caches since many orders changed status
    await deleteCacheByPattern("orders:*");
    sendSuccess(res, 200, "Stuck orders reset successfully", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    sendError(res, 500, "Error resetting stuck orders", error.message);
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const cacheKey = STATS_KEY();

    const cached = await getCache(cacheKey);
    if (cached)
      return sendSuccess(
        res,
        200,
        "Statistics fetched successfully (cached)",
        cached,
      );

    const [statusBreakdown, revenue, productSales] = await Promise.all([
      // Count orders grouped by status
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } },
      ]),

      // Total revenue from delivered orders
      Order.aggregate([
        { $match: { status: OrderStatus.DELIVERED } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalOrders: { $sum: 1 },
          },
        },
        { $project: { _id: 0, totalRevenue: 1, totalOrders: 1 } },
      ]),

      // Top 5 best-selling products by quantity
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalSold: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $project: { _id: 0, productName: "$product.name", totalSold: 1 } },
      ]),
    ]);

    const payload = {
      statusBreakdown,
      revenue: revenue[0] ?? { totalRevenue: 0, totalOrders: 0 },
      topProducts: productSales,
    };
    await setCache(cacheKey, payload, 60 * 10); // 10 min TTL — stats are heavy aggregations
    sendSuccess(res, 200, "Statistics fetched successfully", payload);
  } catch (error: any) {
    sendError(res, 500, "Error fetching statistics", error.message);
  }
};
