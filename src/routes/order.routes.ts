import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRole } from "../middlewares/role.middleware";
import { UserRole } from "../models/User";

const router = Router();

router.use(authenticate);

const adminGuard = authorizeRole(UserRole.ADMIN);
const sellerGuard = authorizeRole(UserRole.SELLER);
const buyerGuard = authorizeRole(UserRole.BUYER);

// ADMIN ROUTES
router.get("/admin", adminGuard, orderController.getAllOrders);
router.put(
  "/admin/:id/status",
  adminGuard,
  orderController.adminUpdateOrderStatus,
);
router.post("/admin/reset", adminGuard, orderController.resetStuckOrders);
router.get("/admin/statistics", adminGuard, orderController.getStatistics);

// SELLER ROUTES
router.get("/seller", sellerGuard, orderController.getSellerOrders);
router.get("/seller/:id", sellerGuard, orderController.getSellerOrderDetails);
router.put(
  "/seller/:id/status",
  sellerGuard,
  orderController.updateOrderStatus,
);

// BUYER ROUTES
router.post("/", buyerGuard, orderController.createOrder);
router.get("/", buyerGuard, orderController.getMyOrders);
router.get("/:id", buyerGuard, orderController.getOrderDetails);
router.get("/:id/status", orderController.getOrderStatus);
router.post("/:id/cancel", buyerGuard, orderController.cancelOrder);

export default router;
