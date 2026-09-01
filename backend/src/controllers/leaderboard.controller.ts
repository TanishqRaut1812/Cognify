import { Request, Response, NextFunction } from 'express';
import { getLeaderboard } from '../services/leaderboard.service';
import { sendSuccess } from '../utils/apiResponse';

export async function getLeaderboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classCode = req.query.class ? String(req.query.class) : 'SY';
    const leaderboard = await getLeaderboard(classCode);
    sendSuccess(res, leaderboard);
  } catch (err) {
    next(err);
  }
}
