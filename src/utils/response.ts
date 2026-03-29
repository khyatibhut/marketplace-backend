import { Response } from "express";

export const sendSuccess = (
  res: Response,
  statusCode: number,
  message: string,
  data: any = null,
) => {
  const response: any = { success: true, message };
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  error: any = null,
) => {
  const response: any = { success: false, message };
  if (error !== null && error !== undefined) {
    response.error = error;
  }
  return res.status(statusCode).json(response);
};
