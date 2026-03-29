import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRole } from "../middlewares/role.middleware";
import { UserRole } from "../models/User";
import { getSellerAnalytics, getSellerRevenueByMonth } from "../controllers/analytics.controller";

const router = Router();

router.use(authenticate, authorizeRole(UserRole.SELLER));

router.get("/", getSellerAnalytics);
router.get("/revenue", getSellerRevenueByMonth);

export default router;
