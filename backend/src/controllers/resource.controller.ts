import { Request, Response, NextFunction } from 'express';
import { getResources, getTestResourceStatus, getResourceDownloadUrl } from '../services/resource.service';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { AppError } from '../types/api.types';

export async function getResourcesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classCode = req.query.class ? String(req.query.class) : undefined;
    const testId = req.query.testId ? parseInt(String(req.query.testId), 10) : undefined;
    const resourceType = req.query.type ? String(req.query.type) : undefined;
    const resources = await getResources(
      classCode,
      isNaN(testId as number) ? undefined : testId,
      resourceType
    );
    sendSuccess(res, resources);
  } catch (err) {
    next(err);
  }
}

export async function getTestResourceStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) {
      sendError(res, 'Invalid test ID', 'VALIDATION_ERROR', 400);
      return;
    }
    const status = await getTestResourceStatus(testId);
    sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
}

export async function getResourceDownloadUrlHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    const resourceType = req.params.type ? String(req.params.type) : undefined;
    if (isNaN(testId) || !resourceType) {
      sendError(res, 'Invalid test ID or resource type', 'VALIDATION_ERROR', 400);
      return;
    }
    const result = await getResourceDownloadUrl(testId, resourceType);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err instanceof AppError) {
      sendError(res, err.message, err.code, err.statusCode);
    } else {
      next(err);
    }
  }
}
