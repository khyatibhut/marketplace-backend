import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRole } from "../middlewares/role.middleware";
import { UserRole } from "../models/User";

const router = Router();

router.get("/", categoryController.getCategories);

const adminGuard = [authenticate, authorizeRole(UserRole.ADMIN)];

router.post("/", adminGuard, categoryController.createCategory);
router.put("/:id", adminGuard, categoryController.updateCategory);
router.delete("/:id", adminGuard, categoryController.deleteCategory);

export default router;
