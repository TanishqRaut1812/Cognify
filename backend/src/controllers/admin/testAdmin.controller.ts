import { Request, Response, NextFunction } from 'express';
import {
  getAdminTests,
  getAdminTestById,
  createTestAdmin,
  updateTestAdmin,
  deleteTestAdmin,
  completeTestAdmin,
  publishResultsAdmin,
  unpublishResultsAdmin
} from '../../services/testAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function getAdminTestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tests = await getAdminTests();
    sendSuccess(res, tests);
  } catch (err) {
    next(err);
  }
}

export async function getAdminTestByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid test ID');
    const test = await getAdminTestById(id);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
}

export async function createTestAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const test = await createTestAdmin(req.body);
    sendSuccess(res, test, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateTestAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid test ID');
    const test = await updateTestAdmin(id, req.body);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
}

export async function deleteTestAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid test ID');
    await deleteTestAdmin(id);
    sendSuccess(res, { message: 'Test deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function completeTestAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const test = await completeTestAdmin(testId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
}

export async function publishResultsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const test = await publishResultsAdmin(testId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
}

export async function unpublishResultsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const test = await unpublishResultsAdmin(testId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
}
