import { Response } from 'express';
import { ApiResponse } from '../types/api.types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response<ApiResponse<T>> {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  code: string = 'INTERNAL_ERROR',
  statusCode: number = 500,
  details?: any
): Response<ApiResponse> {
  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details })
    },
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(payload);
}
