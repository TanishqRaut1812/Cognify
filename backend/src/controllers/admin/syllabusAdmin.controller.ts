import { Request, Response, NextFunction } from 'express';
import { addSyllabusCategoryAdmin, deleteSyllabusCategoryAdmin, updateSyllabusCategoryAdmin } from '../../services/syllabusAdmin.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';

export async function addSyllabusCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) {
      sendError(res, 'Invalid test ID.', 'VALIDATION_ERROR', 400);
      return;
    }

    const { categoryName, topics, title, content, displayOrder } = req.body;
    if (!categoryName || typeof categoryName !== 'string' || !categoryName.trim()) {
      sendError(res, 'Category name is required.', 'VALIDATION_ERROR', 400);
      return;
    }

    const item = await addSyllabusCategoryAdmin(testId, categoryName, topics || '', title, content, displayOrder || 0);
    sendSuccess(res, item, 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteSyllabusCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const syllabusId = parseInt(req.params.id, 10);
    if (isNaN(syllabusId)) {
      sendError(res, 'Invalid syllabus ID.', 'VALIDATION_ERROR', 400);
      return;
    }

    const deleted = await deleteSyllabusCategoryAdmin(syllabusId);
    if (!deleted) {
      sendError(res, 'Syllabus entry not found.', 'NOT_FOUND', 404);
      return;
    }

    sendSuccess(res, { id: syllabusId });
  } catch (err) {
    next(err);
  }
}

export async function updateSyllabusCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const syllabusId = parseInt(req.params.id, 10);
    if (isNaN(syllabusId)) {
      sendError(res, 'Invalid syllabus ID.', 'VALIDATION_ERROR', 400);
      return;
    }

    const { categoryName, topics, displayOrder } = req.body;
    const updated = await updateSyllabusCategoryAdmin(syllabusId, categoryName, topics, displayOrder);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}
