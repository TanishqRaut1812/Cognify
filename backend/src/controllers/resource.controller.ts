import { Request, Response, NextFunction } from 'express';
import { getResources } from '../services/resource.service';
import { sendSuccess } from '../utils/apiResponse';

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
