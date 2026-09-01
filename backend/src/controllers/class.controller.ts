import { Request, Response, NextFunction } from 'express';
import { getAllClasses } from '../services/class.service';
import { sendSuccess } from '../utils/apiResponse';

export async function getClassesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classes = await getAllClasses();
    sendSuccess(res, classes);
  } catch (err) {
    next(err);
  }
}
