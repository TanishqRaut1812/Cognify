import { Request, Response, NextFunction } from 'express';
import { getAdminDashboardStats } from '../../services/dashboardAdmin.service';
import { getAuditLogsAdmin } from '../../services/auditLog.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function getAdminDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getAdminDashboardStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await getAuditLogsAdmin();
    sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
}

