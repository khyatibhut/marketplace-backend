// Generate a unique order tracking number
// Example format: ORD-20260328-X7B9
export const generateOrderNumber = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${dateStr}-${randomStr}`;
};

// Convert any string to a URL-friendly slug
// Example: "Apple iPhone 15 Pro" -> "apple-iphone-15-pro"
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
};

// Calculate the final price after applying a percentage discount
export const calculateDiscount = (
  price: number,
  discountPercentage: number,
): number => {
  if (discountPercentage <= 0) return price;
  if (discountPercentage >= 100) return 0;

  const discountAmount = price * (discountPercentage / 100);
  return Number((price - discountAmount).toFixed(2));
};


// Check if an object is empty
export const isEmptyObject = (obj: Record<string, any>): boolean => {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
};

// Pagination

import { Request } from "express";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationContext {
  page: number;
  limit: number;
  skip: number;
  paginate: (total: number) => PaginationMeta;
}

export const getPagination = (req: Request): PaginationContext => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT),
  );
  const skip = (page - 1) * limit;

  const paginate = (total: number): PaginationMeta => {
    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    return {
      total,
      page,
      limit,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    };
  };

  return { page, limit, skip, paginate };
};
