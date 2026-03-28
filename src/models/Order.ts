import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

export enum OrderStatus {
  PLACED = 'placed',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

export interface IOrderItem {
  productId: mongoose.Types.ObjectId | IProduct;
  quantity: number;
  pricePerItem: number; // Snapshot of the product price at checkout
}

export interface ITrackingEvent {
  status: OrderStatus;
  timestamp: Date;
  comment?: string;
}

export interface IOrder extends Document {
  buyerId: mongoose.Types.ObjectId | IUser;
  sellerIds: mongoose.Types.ObjectId[]; // Denormalized for rapid Seller order filtering
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  status: OrderStatus;
  currentJobId?: string; // Links to BullMQ delay job for possible cancellation/tracking
  statusHistory: ITrackingEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    pricePerItem: { type: Number, required: true, min: 0 }
  },
  { _id: false } // No separate ID needed for subdocuments
);

const trackingEventSchema = new Schema<ITrackingEvent>(
  {
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    timestamp: { type: Date, default: Date.now },
    comment: { type: String }
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    items: {
      type: [orderItemSchema],
      validate: [(v: IOrderItem[]) => v.length > 0, 'Order must have at least one item']
    },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, required: true }
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PLACED,
      index: true
    },
    currentJobId: { type: String, sparse: true }, // BullMQ Job reference
    statusHistory: [trackingEventSchema]
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
