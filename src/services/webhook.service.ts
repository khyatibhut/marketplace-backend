import axios from "axios";
import { WebhookSubscription } from "../models/WebhookSubscription";

/**
 * Service to notify users via webhooks when events occur.
 */
export const triggerWebhooks = async (
  userId: string | string[],
  event: string,
  payload: any
) => {
  try {
    const userIds = Array.isArray(userId) ? userId : [userId];
    const subscriptions = await WebhookSubscription.find({
      userId: { $in: userIds },
      events: event,
      isActive: true,
    });

    if (subscriptions.length === 0) return;

    // Fire notifications concurrently — we don't block the caller
    subscriptions.forEach((sub) => {
      axios
        .post(sub.url, {
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        })
        .catch((err) => {
          console.error(`[Webhook] Failed to push to ${sub.url}:`, err.message);
          // could logic for exponential backoff here if needed
        });
    });
  } catch (error) {
    console.error("[Webhook] Error triggering webhooks:", error);
  }
};
