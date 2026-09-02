import { Router } from 'express';
import { getClassesHandler } from '../controllers/class.controller';
import { getTestsHandler, getTestByIdHandler, getTestQuestionsHandler } from '../controllers/test.controller';
import { getSyllabusHandler } from '../controllers/syllabus.controller';
import {
  getResourcesHandler,
  getTestResourceStatusHandler,
  getResourceDownloadUrlHandler
} from '../controllers/resource.controller';
import { getLeaderboardHandler } from '../controllers/leaderboard.controller';

const router = Router();

// Classes API
router.get('/classes', getClassesHandler);

// Tests API
router.get('/tests', getTestsHandler);
router.get('/tests/:testId', getTestByIdHandler);
router.get('/tests/:testId/questions', getTestQuestionsHandler);

// Syllabus API
router.get('/syllabus', getSyllabusHandler);

// Resources API
router.get('/resources', getResourcesHandler);
router.get('/tests/:testId/resources-status', getTestResourceStatusHandler);
router.get('/tests/:testId/resources/:type/download', getResourceDownloadUrlHandler);

// Leaderboard API
router.get('/leaderboard', getLeaderboardHandler);

export default router;
