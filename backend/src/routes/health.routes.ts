import { Router, Request, Response, NextFunction } from 'express';
import { checkDatabaseHealth } from '../db/pool';
import { checkStorageHealth } from '../services/storage.service';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

// GET /api/health - Process health check
router.get('/', (req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'online',
    service: 'Cognify Production Backend Engine',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// GET /api/health/db - Database connectivity health check
router.get('/db', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    sendSuccess(res, dbHealth);
  } catch (err) {
    next(err);
  }
});

// GET /api/health/storage - Object storage connectivity health check
router.get('/storage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storageHealth = await checkStorageHealth();
    sendSuccess(res, storageHealth);
  } catch (err) {
    next(err);
  }
});

export default router;
