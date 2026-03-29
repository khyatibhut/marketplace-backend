import { Router } from "express";
import * as ratingController from "../controllers/rating.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRole } from "../middlewares/role.middleware";
import { UserRole } from "../models/User";

const router = Router();

router.get("/product/:productId", ratingController.getProductRatings);
router.post(
  "/",
  authenticate,
  authorizeRole(UserRole.BUYER),
  ratingController.createRating,
);

export default router;
