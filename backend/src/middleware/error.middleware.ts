import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/api.types';
import { sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : err.statusCode || err.status || 500;
  const code = err instanceof AppError ? err.code : err.code || 'INTERNAL_SERVER_ERROR';

  // Sanitize message: never expose internal SQL or database details in production
  let message = err.message || 'An unexpected server error occurred';
  if (process.env.NODE_ENV === 'production' && !(err instanceof AppError)) {
    message = 'An internal server error occurred';
  }

  // Log full detailed error server-side
  logger.error(`[API ERROR] ${req.method} ${req.originalUrl} - ${statusCode} [${code}]:`, {
    message: err.message,
    code,
    stack: err.stack
  });

  const details = process.env.NODE_ENV === 'development' ? err.details : undefined;
  sendError(res, message, code, statusCode, details);
}
