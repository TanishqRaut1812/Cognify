import { Request, Response, NextFunction } from 'express';
import {
  getAdminQuestionsForTest,
  getQuestionByIdAdmin,
  createQuestionAdmin,
  updateQuestionAdmin,
  deleteQuestionAdmin,
  importQuestionsFromExcel
} from '../../services/questionAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function getAdminQuestionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const questions = await getAdminQuestionsForTest(testId);
    sendSuccess(res, questions);
  } catch (err) {
    next(err);
  }
}

export async function getQuestionByIdAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid question ID');
    const question = await getQuestionByIdAdmin(id);
    sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
}

export async function createQuestionAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const question = await createQuestionAdmin({ ...req.body, testId });
    sendSuccess(res, question, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateQuestionAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid question ID');
    const question = await updateQuestionAdmin(id, req.body);
    sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestionAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid question ID');
    await deleteQuestionAdmin(id);
    sendSuccess(res, { message: 'Question deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function importQuestionsExcelHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    if (!req.file) throw new ValidationError('No Excel file uploaded');
    const summary = await importQuestionsFromExcel(testId, req.file.buffer, req.file.originalname);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}
