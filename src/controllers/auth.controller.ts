import { Request, Response } from 'express';

export const register = async (req: Request, res: Response) => {
  res.status(201).json({ message: 'User registered' });
};

export const login = async (req: Request, res: Response) => {
  res.status(200).json({ message: 'User logged in', token: 'dummy_token' });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  res.status(200).json({ message: 'Current user profile', user: req.user });
};
