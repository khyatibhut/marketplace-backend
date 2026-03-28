import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';
import { IOrder } from './Order';
import { IProduct } from './Product';

export interface IRating extends Document {
  orderId: mongoose.Types.ObjectId | IOrder;
  buyerId: mongoose.Types.ObjectId | IUser;
  productId: mongoose.Types.ObjectId | IProduct;
  score: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    score: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    comment: { type: String, maxlength: 500 }
  },
  { timestamps: true }
);

// Prevent users from rating the exact same product from the exact same order twice
ratingSchema.index({ orderId: 1, productId: 1, buyerId: 1 }, { unique: true });

export const Rating = mongoose.model<IRating>('Rating', ratingSchema);
