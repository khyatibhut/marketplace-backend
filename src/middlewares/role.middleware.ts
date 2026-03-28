import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

export const authorizeRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Unauthorized. Role missing.' });
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ message: 'Forbidden. You do not have permission to access this resource.' });
    }

    next();
  };
};
