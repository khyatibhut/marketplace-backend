import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  statusCode: number,
  message: string,
  data: any = null
) => {
  const response: any = { success: true, message };
  if (data !== null && data !== undefined) {
    // If data is an object, we can either wrap it in `data` or spread it.
    // the standard is to put it under `data`.
    response.data = data;
  }
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  error: any = null
) => {
  const response: any = { success: false, message };
  if (error !== null && error !== undefined) {
    response.error = error;
  }
  return res.status(statusCode).json(response);
};
