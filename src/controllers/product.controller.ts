import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { Product } from '../models/Product';
import { createProductSchema, updateProductSchema } from '../utils/validators';
import { getPagination } from '../utils/common';
import { getCache, setCache, deleteCache, deleteCacheByPattern } from '../utils/cache';

// ─── Cache key builders (public reads only) ─────────────────────────────────
const PRODUCT_KEY = (id: string) => `product:${id}`;
const PRODUCTS_LIST_KEY = (qs: string) => `products:list:${qs}`;
const STOCK_KEY = (id: string) => `stock:${id}`;

/** Invalidate public product caches on write */
const invalidateProductCaches = async (productId?: string) => {
  const tasks: Promise<void>[] = [deleteCacheByPattern('products:list:*')];
  if (productId) tasks.push(deleteCache(PRODUCT_KEY(productId)), deleteCache(STOCK_KEY(productId)));
  await Promise.all(tasks);
};

// ─── Public: GET /products ────────────────────────────────────────────────────
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { skip, limit, paginate } = getPagination(req);
    const cacheKey = PRODUCTS_LIST_KEY(new URLSearchParams(req.query as any).toString());

    const cached = await getCache(cacheKey);
    if (cached) return sendSuccess(res, 200, 'Products listed successfully (cached)', cached);

    const query: any = {};
    if (req.query.search)   query.$text = { $search: req.query.search as string };
    if (req.query.category) query.categoryId = req.query.category;
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('categoryId', 'name')
        .populate('sellerId', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Product.countDocuments(query)
    ]);

    const payload = { products, pagination: paginate(total) };
    await setCache(cacheKey, payload);

    sendSuccess(res, 200, 'Products listed successfully', payload);
  } catch (error: any) {
    sendError(res, 500, 'Error listing products', error.message);
  }
};

// ─── Public: GET /products/:id ────────────────────────────────────────────────
export const getProductById = async (req: Request, res: Response) => {
  try {
    const cacheKey = PRODUCT_KEY(req.params.id);

    const cached = await getCache(cacheKey);
    if (cached) return sendSuccess(res, 200, 'Product details fetched successfully (cached)', { product: cached });

    const product = await Product.findById(req.params.id)
      .populate('categoryId', 'name description')
      .populate('sellerId', 'name email')
      .lean();

    if (!product) return sendError(res, 404, 'Product not found');

    await setCache(cacheKey, product, 600); // 10 min TTL
    sendSuccess(res, 200, 'Product details fetched successfully', { product });
  } catch (error: any) {
    sendError(res, 500, 'Error fetching product details', error.message);
  }
};

// ─── Public: GET /products/:id/stock ──────────────────────────────────────────
export const getProductStock = async (req: Request, res: Response) => {
  try {
    const cacheKey = STOCK_KEY(req.params.id);

    const cached = await getCache<{ stock: number }>(cacheKey);
    if (cached) return sendSuccess(res, 200, 'Product stock fetched successfully (cached)', cached);

    const product = await Product.findById(req.params.id).select('stock').lean();
    if (!product) return sendError(res, 404, 'Product not found');

    const payload = { stock: product.stock };
    await setCache(cacheKey, payload, 60); // 1 min TTL
    sendSuccess(res, 200, 'Product stock fetched successfully', payload);
  } catch (error: any) {
    sendError(res, 500, 'Error fetching product stock', error.message);
  }
};

// ─── Seller: GET /products/seller/me ─────────────────────────────────────────
export const getSellerProducts = async (req: Request, res: Response) => {
  try {
    const { skip, limit, paginate } = getPagination(req);

    const [products, total] = await Promise.all([
      Product.find({ sellerId: req.user.id })
        .populate('categoryId', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Product.countDocuments({ sellerId: req.user.id })
    ]);

    sendSuccess(res, 200, 'Seller products fetched successfully', {
      products,
      pagination: paginate(total)
    });
  } catch (error: any) {
    sendError(res, 500, 'Error fetching seller products', error.message);
  }
};

// ─── Seller: POST /products ───────────────────────────────────────────────────
export const createProduct = async (req: Request, res: Response) => {
  try {
    const validatedData = createProductSchema.parse(req.body);

    const product = await Product.create({ ...validatedData, sellerId: req.user.id });

    await invalidateProductCaches();

    sendSuccess(res, 201, 'Product created successfully', { product });
  } catch (error: any) {
    if (error.name === 'ZodError') return sendError(res, 400, 'Validation error', error.errors);
    sendError(res, 500, 'Error creating product', error.message);
  }
};

// ─── Seller: PUT /products/:id ────────────────────────────────────────────────
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const validatedData = updateProductSchema.parse(req.body);

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.user.id },
      validatedData,
      { new: true, runValidators: true }
    );

    if (!product) return sendError(res, 404, 'Product not found or unauthorized to update');

    // Bust product detail cache + public list caches
    await invalidateProductCaches(req.params.id);

    sendSuccess(res, 200, 'Product updated successfully', { product });
  } catch (error: any) {
    if (error.name === 'ZodError') return sendError(res, 400, 'Validation error', error.errors);
    sendError(res, 500, 'Error updating product', error.message);
  }
};

// ─── Seller: DELETE /products/:id ────────────────────────────────────────────
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, sellerId: req.user.id });

    if (!product) return sendError(res, 404, 'Product not found or unauthorized to delete');

    // Bust product detail cache + public list caches
    await invalidateProductCaches(req.params.id);

    sendSuccess(res, 200, 'Product deleted successfully');
  } catch (error: any) {
    sendError(res, 500, 'Error deleting product', error.message);
  }
};
