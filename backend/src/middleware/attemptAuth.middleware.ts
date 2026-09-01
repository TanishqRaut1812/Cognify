import { Request, Response, NextFunction } from 'express';
import { verifyAttemptToken, StudentAttemptJwtPayload } from '../services/studentAuth.service';
import { sendError } from '../utils/apiResponse';

export interface AuthenticatedAttemptRequest extends Request {
  attemptUser?: StudentAttemptJwtPayload;
}

export function requireAttemptAuth(
  req: AuthenticatedAttemptRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      sendError(res, 'Student attempt authentication token required', 'UNAUTHORIZED', 401);
      return;
    }

    const decoded = verifyAttemptToken(token);

    // Verify parameter attemptId match if present
    if (req.params.attemptId) {
      const paramAttemptId = parseInt(req.params.attemptId, 10);
      if (!isNaN(paramAttemptId) && paramAttemptId !== decoded.attemptId) {
        sendError(res, 'Attempt token is not valid for this attempt ID', 'FORBIDDEN', 403);
        return;
      }
    }

    req.attemptUser = decoded;
    next();
  } catch (err: any) {
    const statusCode = err.statusCode || 401;
    const code = err.code || 'UNAUTHORIZED';
    sendError(res, err.message || 'Attempt authentication failed', code, statusCode);
  }
}
