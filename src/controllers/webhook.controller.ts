import { Request, Response } from "express";
import { WebhookSubscription } from "../models/WebhookSubscription";
import { sendSuccess, sendError } from "../utils/response";

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { url, events } = req.body;
    if (!url) return sendError(res, 400, "Webhook URL is required");

    const subscription = await WebhookSubscription.create({
      userId: req.user.id,
      url,
      events: events || ["order.status_updated"],
    });

    sendSuccess(res, 201, "Webhook subscription created successfully", { subscription });
  } catch (error: any) {
    sendError(res, 500, "Error creating subscription", error.message);
  }
};

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const subscriptions = await WebhookSubscription.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    sendSuccess(res, 200, "Webhook subscriptions fetched successfully", { subscriptions });
  } catch (error: any) {
    sendError(res, 500, "Error fetching subscriptions", error.message);
  }
};

export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    const subscription = await WebhookSubscription.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!subscription) return sendError(res, 404, "Subscription not found");
    sendSuccess(res, 200, "Webhook subscription deleted successfully");
  } catch (error: any) {
    sendError(res, 500, "Error deleting subscription", error.message);
  }
};
