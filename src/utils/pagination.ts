import { Request } from 'express';

export const getPaginationOptions = (req: Request) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
  const skip = Math.max(0, (page - 1) * limit);

  return { page, limit, skip };
};

export const getPaginationResult = (total: number, page: number, limit: number) => {
  return {
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};
