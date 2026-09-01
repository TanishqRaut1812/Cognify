import { Request, Response, NextFunction } from 'express';
import { getTestAttemptsAdmin, getAttemptByIdAdmin } from '../../services/attemptAdmin.service';
import { getTestResultsAdmin, getResultByIdAdmin, overrideStudentScoreAdmin } from '../../services/resultAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function getTestAttemptsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const attempts = await getTestAttemptsAdmin(testId);
    sendSuccess(res, attempts);
  } catch (err) {
    next(err);
  }
}

export async function getAttemptByIdAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(attemptId)) throw new ValidationError('Invalid attempt ID');
    const attempt = await getAttemptByIdAdmin(attemptId);
    sendSuccess(res, attempt);
  } catch (err) {
    next(err);
  }
}

export async function getTestResultsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const results = await getTestResultsAdmin(testId);
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
}

export async function getResultByIdAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid result ID');
    const result = await getResultByIdAdmin(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function overrideStudentScoreAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid result ID');
    const { marksObtained } = req.body;
    if (marksObtained === undefined || isNaN(parseFloat(marksObtained))) {
      throw new ValidationError('Valid marksObtained is required');
    }
    const result = await overrideStudentScoreAdmin(id, parseFloat(marksObtained));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
