import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AdminJwtPayload } from '../services/adminAuth.service';
import { sendError } from '../utils/apiResponse';

export interface AuthenticatedRequest extends Request {
  user?: AdminJwtPayload;
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback to Cookie header parsing
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').map((c) => c.trim());
      const tokenCookie = cookies.find((c) => c.startsWith('admin_token='));
      if (tokenCookie) {
        token = tokenCookie.substring('admin_token='.length).trim();
      }
    }

    if (!token) {
      sendError(res, 'Admin authentication required', 'UNAUTHORIZED', 401);
      return;
    }

    const decoded = verifyAdminToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    const statusCode = err.statusCode || 401;
    const code = err.code || 'UNAUTHORIZED';
    sendError(res, err.message || 'Authentication failed', code, statusCode);
  }
}
