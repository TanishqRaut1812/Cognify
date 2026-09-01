import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    role: 'admin' | 'student';
    registration_no?: string;
    test_id?: number;
  };
}

export function authMiddleware(requiredRole?: 'admin' | 'student') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.cognify_token) {
      token = req.cookies.cognify_token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      req.user = decoded;

      if (requiredRole && req.user?.role !== requiredRole) {
        res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges.' });
        return;
      }

      next();
    } catch (err) {
      res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
    }
  };
}
