import { Request, Response } from "express";
import mongoose from "mongoose";
import { sendSuccess, sendError } from "../utils/response";
import { Order, OrderStatus } from "../models/Order";
import { Product } from "../models/Product";
import { Rating } from "../models/Rating";
import { getCache, setCache } from "../utils/cache";

const ANALYTICS_CACHE_TTL = 60 * 5; // 5 minutes

export const getSellerAnalytics = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user.id;
    const cacheKey = `analytics:seller:${sellerId}`;

    const cached = await getCache(cacheKey);
    if (cached) return sendSuccess(res, 200, "Analytics fetched (cached)", cached);

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

    const [revenueStats, statusBreakdown, topProducts, recentOrders, productStats] =
      await Promise.all([
        // Total revenue and order count from delivered orders
        Order.aggregate([
          { $match: { sellerIds: sellerObjectId, status: OrderStatus.DELIVERED } },
          { $unwind: "$items" },
          {
            $lookup: {
              from: "products",
              localField: "items.productId",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: "$product" },
          { $match: { "product.sellerId": sellerObjectId } },
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: { $multiply: ["$items.pricePerItem", "$items.quantity"] },
              },
              totalOrders: { $addToSet: "$_id" },
              totalItemsSold: { $sum: "$items.quantity" },
            },
          },
          {
            $project: {
              _id: 0,
              totalRevenue: 1,
              totalOrders: { $size: "$totalOrders" },
              totalItemsSold: 1,
            },
          },
        ]),

        // Order count by status
        Order.aggregate([
          { $match: { sellerIds: sellerObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $project: { status: "$_id", count: 1, _id: 0 } },
        ]),

        // Top 5 best-selling products for this seller
        Order.aggregate([
          { $match: { sellerIds: sellerObjectId, status: OrderStatus.DELIVERED } },
          { $unwind: "$items" },
          {
            $lookup: {
              from: "products",
              localField: "items.productId",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: "$product" },
          { $match: { "product.sellerId": sellerObjectId } },
          {
            $group: {
              _id: "$items.productId",
              name: { $first: "$product.name" },
              totalSold: { $sum: "$items.quantity" },
              totalRevenue: {
                $sum: { $multiply: ["$items.pricePerItem", "$items.quantity"] },
              },
            },
          },
          { $sort: { totalSold: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              productId: "$_id",
              name: 1,
              totalSold: 1,
              totalRevenue: 1,
            },
          },
        ]),

        // Last 5 recent orders
        Order.find({ sellerIds: sellerObjectId })
          .populate("buyerId", "name email")
          .select("status totalAmount createdAt buyerId")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),

        // Product count and avg rating per product
        Product.aggregate([
          { $match: { sellerId: sellerObjectId } },
          {
            $lookup: {
              from: "ratings",
              localField: "_id",
              foreignField: "productId",
              as: "ratings",
            },
          },
          {
            $project: {
              _id: 0,
              totalProducts: { $sum: 1 },
              totalStock: "$stock",
              averageRating: { $avg: "$ratings.score" },
            },
          },
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              totalStock: { $sum: "$totalStock" },
              averageRating: { $avg: "$averageRating" },
            },
          },
          { $project: { _id: 0, totalProducts: 1, totalStock: 1, averageRating: 1 } },
        ]),
      ]);

    const payload = {
      revenue: revenueStats[0] ?? { totalRevenue: 0, totalOrders: 0, totalItemsSold: 0 },
      statusBreakdown,
      topProducts,
      recentOrders,
      productSummary: productStats[0] ?? { totalProducts: 0, totalStock: 0, averageRating: 0 },
    };

    await setCache(cacheKey, payload, ANALYTICS_CACHE_TTL);
    sendSuccess(res, 200, "Analytics fetched successfully", payload);
  } catch (error: any) {
    sendError(res, 500, "Error fetching seller analytics", error.message);
  }
};

// Monthly revenue breakdown for the current year
export const getSellerRevenueByMonth = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user.id;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const cacheKey = `analytics:seller:${sellerId}:revenue:${year}`;

    const cached = await getCache(cacheKey);
    if (cached) return sendSuccess(res, 200, "Revenue data fetched (cached)", cached);

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          sellerIds: sellerObjectId,
          status: OrderStatus.DELIVERED,
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.sellerId": sellerObjectId } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          revenue: { $sum: { $multiply: ["$items.pricePerItem", "$items.quantity"] } },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id.month",
          revenue: 1,
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { month: 1 } },
    ]);

    await setCache(cacheKey, { year, monthlyRevenue }, ANALYTICS_CACHE_TTL);
    sendSuccess(res, 200, "Monthly revenue fetched successfully", { year, monthlyRevenue });
  } catch (error: any) {
    sendError(res, 500, "Error fetching monthly revenue", error.message);
  }
};
