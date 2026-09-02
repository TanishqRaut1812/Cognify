import { Request, Response, NextFunction } from 'express';
import { getAdminDashboardStats, getTestDashboardStats } from '../../services/dashboardAdmin.service';
import { getAuditLogsAdmin } from '../../services/auditLog.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function getAdminDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getAdminDashboardStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function getTestDashboardStatsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const stats = await getTestDashboardStats(testId);
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
