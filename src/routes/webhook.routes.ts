import { Router } from "express";
import * as webhookController from "../controllers/webhook.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", webhookController.createSubscription);
router.get("/", webhookController.getSubscriptions);
router.delete("/:id", webhookController.deleteSubscription);

export default router;
