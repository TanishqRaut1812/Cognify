import { Request, Response, NextFunction } from 'express';
import { getAdminDashboardStats } from '../../services/dashboardAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function getAdminDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getAdminDashboardStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}
