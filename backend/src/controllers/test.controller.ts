import { Request, Response, NextFunction } from 'express';
import { getTests, getTestById } from '../services/test.service';
import { getQuestionsForTest } from '../services/question.service';
import { sendSuccess } from '../utils/apiResponse';
import { ValidationError } from '../types/api.types';

export async function getTestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classCode = req.query.class ? String(req.query.class) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const tests = await getTests(classCode, status);
    sendSuccess(res, tests);
  } catch (err) {
    next(err);
  }
}

export async function getTestByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) {
      throw new ValidationError('Invalid test ID parameter');
    }
    const test = await getTestById(testId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
}

export async function getTestQuestionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) {
      throw new ValidationError('Invalid test ID parameter');
    }
    const questions = await getQuestionsForTest(testId);
    sendSuccess(res, questions);
  } catch (err) {
    next(err);
  }
}
