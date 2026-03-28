import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';
import { ICategory } from './Category';

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId | IUser;
  categoryId: mongoose.Types.ObjectId | ICategory;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, minlength: 3, maxlength: 100, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: [0.01, 'Price must be greater than zero'] },
    stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0 },
    images: [{ type: String }]
  },
  { timestamps: true }
);

// Compound indexes for rapid marketplace filtering
productSchema.index({ categoryId: 1, price: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Search optimization

export const Product = mongoose.model<IProduct>('Product', productSchema);
