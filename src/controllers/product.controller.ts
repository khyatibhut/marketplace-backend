import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

export const getProducts = async (req: Request, res: Response) => {
  sendSuccess(res, 200, 'Filterable product list');
};

export const getProductById = async (req: Request, res: Response) => {
  sendSuccess(res, 200, `Details for product ${req.params.id}`);
};

export const getSellerProducts = async (req: Request, res: Response) => {
  sendSuccess(res, 200, 'Products owned by the authenticated seller');
};

export const createProduct = async (req: Request, res: Response) => {
  sendSuccess(res, 201, 'Product created');
};

export const updateProduct = async (req: Request, res: Response) => {
  sendSuccess(res, 200, `Product ${req.params.id} updated`);
};

export const deleteProduct = async (req: Request, res: Response) => {
  sendSuccess(res, 200, `Product ${req.params.id} deleted`);
};
