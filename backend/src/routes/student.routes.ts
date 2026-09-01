import { Router } from 'express';
import { requireAttemptAuth } from '../middleware/attemptAuth.middleware';
import { requireStudentAuth } from '../middleware/studentAuth.middleware';
import {
  verifyStudentHandler,
  getAvailableTestsHandler,
  startTestHandler,
  getAttemptDetailsHandler,
  getExamQuestionsHandler,
  saveStudentAnswerHandler,
  getSavedAnswersHandler,
  reportFullscreenViolationHandler,
  submitTestAttemptHandler,
  getStudentResultsHandler
} from '../controllers/studentExam.controller';

const router = Router();

// PUBLIC STUDENT ENDPOINTS
router.post('/verify', verifyStudentHandler);
router.get('/tests', getAvailableTestsHandler);
router.post('/tests/:testId/start', startTestHandler);

// PROTECTED STUDENT RESULTS ENDPOINT (Requires Student Session Token or Attempt Token)
router.get('/results', requireStudentAuth, getStudentResultsHandler);

// PROTECTED STUDENT ATTEMPT ENDPOINTS (Require Bearer attemptToken)
router.use('/attempts/:attemptId', requireAttemptAuth);

router.get('/attempts/:attemptId', getAttemptDetailsHandler);
router.get('/attempts/:attemptId/questions', getExamQuestionsHandler);
router.put('/attempts/:attemptId/answers/:questionId', saveStudentAnswerHandler);
router.get('/attempts/:attemptId/answers', getSavedAnswersHandler);
router.post('/attempts/:attemptId/fullscreen-violation', reportFullscreenViolationHandler);
router.post('/attempts/:attemptId/submit', submitTestAttemptHandler);

export default router;
