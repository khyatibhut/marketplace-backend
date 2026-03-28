import mongoose, { Document, Schema } from 'mongoose';

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN'
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string; // Optional if supporting OAuth later
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.BUYER
    }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
