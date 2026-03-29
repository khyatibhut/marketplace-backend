import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRole } from "../middlewares/role.middleware";
import { UserRole } from "../models/User";

const router = Router();

// Public Buyer/Admin endpoints
router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);
router.get("/:id/stock", productController.getProductStock);

// Seller endpoints
const sellerGuard = [authenticate, authorizeRole(UserRole.SELLER)];

router.get("/seller/me", sellerGuard, productController.getSellerProducts);
router.post("/", sellerGuard, productController.createProduct);
router.put("/:id", sellerGuard, productController.updateProduct);
router.delete("/:id", sellerGuard, productController.deleteProduct);

export default router;
