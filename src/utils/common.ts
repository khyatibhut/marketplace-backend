/**
 * Generate a unique order tracking number
 * Example format: ORD-20260328-X7B9
 */
export const generateOrderNumber = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${dateStr}-${randomStr}`;
};

/**
 * Convert any string to a URL-friendly slug
 * Example: "Apple iPhone 15 Pro" -> "apple-iphone-15-pro"
 */
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // Replace spaces with -
    .replace(/[^\w-]+/g, '')    // Remove all non-word chars
    .replace(/--+/g, '-');      // Replace multiple - with single -
};

/**
 * Calculate the final price after applying a percentage discount
 */
export const calculateDiscount = (price: number, discountPercentage: number): number => {
  if (discountPercentage <= 0) return price;
  if (discountPercentage >= 100) return 0;
  
  const discountAmount = price * (discountPercentage / 100);
  return Number((price - discountAmount).toFixed(2));
};

/**
 * Check if an object is empty
 */
export const isEmptyObject = (obj: Record<string, any>): boolean => {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
};
