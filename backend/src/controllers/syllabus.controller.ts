import { Request, Response, NextFunction } from 'express';
import { getSyllabus } from '../services/syllabus.service';
import { sendSuccess } from '../utils/apiResponse';

export async function getSyllabusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classCode = req.query.class ? String(req.query.class) : undefined;
    const testId = req.query.testId ? parseInt(String(req.query.testId), 10) : undefined;
    const syllabus = await getSyllabus(classCode, isNaN(testId as number) ? undefined : testId);
    sendSuccess(res, syllabus);
  } catch (err) {
    next(err);
  }
}
