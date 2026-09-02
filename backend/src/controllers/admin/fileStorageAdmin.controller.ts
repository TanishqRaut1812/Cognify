import { Request, Response, NextFunction } from 'express';
import { uploadQuestionPaperAdmin, uploadAnswerKeyAdmin, uploadResourceAdmin } from '../../services/fileStorageAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function uploadQuestionPaperHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    if (!req.file) throw new ValidationError('No file uploaded');
    const result = await uploadQuestionPaperAdmin(testId, req.file.buffer, req.file.originalname);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function uploadAnswerKeyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    if (!req.file) throw new ValidationError('No file uploaded');
    const result = await uploadAnswerKeyAdmin(testId, req.file.buffer, req.file.originalname);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function uploadResourceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    if (!req.file) throw new ValidationError('No file uploaded');
    const { title, resourceType } = req.body;
    const type = resourceType || 'notes';
    const docTitle = title || req.file.originalname;
    const result = await uploadResourceAdmin(testId, docTitle, type, req.file.buffer, req.file.originalname);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}
