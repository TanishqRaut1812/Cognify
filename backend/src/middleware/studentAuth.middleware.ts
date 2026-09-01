import { Request, Response, NextFunction } from 'express';
import { verifyStudentSessionToken, StudentSessionJwtPayload, StudentAttemptJwtPayload } from '../services/studentAuth.service';
import { sendError } from '../utils/apiResponse';

export interface AuthenticatedStudentRequest extends Request {
  studentUser?: StudentSessionJwtPayload | StudentAttemptJwtPayload;
}

export function requireStudentAuth(
  req: AuthenticatedStudentRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token && req.query.token) {
      token = String(req.query.token).trim();
    }

    if (!token) {
      sendError(res, 'Student authentication token required', 'UNAUTHORIZED', 401);
      return;
    }

    const decoded = verifyStudentSessionToken(token);

    // Enforce IDOR protection: query/body registrationNumber must match token registrationNo
    const targetRegNo = (
      req.query.registrationNumber ||
      req.params.registrationNumber ||
      req.body.registrationNumber
    )?.toString().trim().toUpperCase();

    if (targetRegNo && targetRegNo !== decoded.registrationNo.toUpperCase()) {
      sendError(res, 'Access forbidden: Cannot access results of another student', 'FORBIDDEN', 403);
      return;
    }

    req.studentUser = decoded;
    next();
  } catch (err: any) {
    const statusCode = err.statusCode || 401;
    const code = err.code || 'UNAUTHORIZED';
    sendError(res, err.message || 'Student authentication failed', code, statusCode);
  }
}
