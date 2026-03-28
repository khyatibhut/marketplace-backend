import { Request, Response } from 'express';

export const getProducts = async (req: Request, res: Response) => {
  res.status(200).json({ message: 'Filterable product list' });
};

export const getProductById = async (req: Request, res: Response) => {
  res.status(200).json({ message: `Details for product ${req.params.id}` });
};

export const getSellerProducts = async (req: Request, res: Response) => {
  res.status(200).json({ message: 'Products owned by the authenticated seller' });
};

export const createProduct = async (req: Request, res: Response) => {
  res.status(201).json({ message: 'Product created' });
};

export const updateProduct = async (req: Request, res: Response) => {
  res.status(200).json({ message: `Product ${req.params.id} updated` });
};

export const deleteProduct = async (req: Request, res: Response) => {
  res.status(200).json({ message: `Product ${req.params.id} deleted` });
};
