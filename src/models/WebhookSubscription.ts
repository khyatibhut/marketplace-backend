import { Schema, model, Document } from "mongoose";

export interface IWebhookSubscription extends Document {
  userId: Schema.Types.ObjectId;
  url: string;
  events: string[]; // e.g., ["order.status_updated", "order.cancelled"]
  isActive: boolean;
  createdAt: Date;
}

const webhookSubscriptionSchema = new Schema<IWebhookSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true },
    events: { type: [String], default: ["order.status_updated"] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const WebhookSubscription = model<IWebhookSubscription>(
  "WebhookSubscription",
  webhookSubscriptionSchema
);
