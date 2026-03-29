import { Request, Response } from "express";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { sendSuccess, sendError } from "../utils/response";

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    sendSuccess(res, 200, "Categories fetched successfully", { categories });
  } catch (error: any) {
    sendError(res, 500, "Error fetching categories", error.message);
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return sendError(res, 400, "Category name is required");

    const category = await Category.create({ name, description });
    sendSuccess(res, 201, "Category created successfully", { category });
  } catch (error: any) {
    if (error.code === 11000) return sendError(res, 409, "Category already exists");
    sendError(res, 500, "Error creating category", error.message);
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true, runValidators: true }
    );

    if (!category) return sendError(res, 404, "Category not found");
    sendSuccess(res, 200, "Category updated successfully", { category });
  } catch (error: any) {
    sendError(res, 500, "Error updating category", error.message);
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    // Check if any products use this category before deleting
    const productCount = await Product.countDocuments({ categoryId: req.params.id });
    if (productCount > 0) {
      return sendError(res, 400, `Cannot delete category: ${productCount} products are still using it`);
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return sendError(res, 404, "Category not found");
    sendSuccess(res, 200, "Category deleted successfully");
  } catch (error: any) {
    sendError(res, 500, "Error deleting category", error.message);
  }
};
