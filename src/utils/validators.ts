import { z } from 'zod';
import { UserRole } from '../models/User';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.nativeEnum(UserRole).optional() // Allows passing BUYER, SELLER, ADMIN
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createProductSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be greater than zero'),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ID'),
  stock: z.number().int().nonnegative('Stock cannot be negative').default(0),
  images: z.array(z.string().url('Image must be a valid URL')).optional()
});

export const updateProductSchema = createProductSchema.partial();

export const createRatingSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Order ID'),
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID'),
  score: z.number().int().min(1, 'Score must be at least 1').max(5, 'Score cannot exceed 5'),
  comment: z.string().max(500, 'Comment cannot exceed 500 characters').optional()
});
