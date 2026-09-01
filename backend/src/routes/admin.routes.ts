import { Router } from 'express';
import { requireAdminAuth } from '../middleware/auth.middleware';
import { uploadSingleFile } from '../middleware/upload.middleware';

import { loginAdminHandler, logoutAdminHandler, getAdminMeHandler } from '../controllers/adminAuth.controller';
import {
  getStudentsAdminHandler,
  getStudentByIdAdminHandler,
  createStudentAdminHandler,
  updateStudentAdminHandler,
  deleteStudentAdminHandler,
  importStudentsExcelHandler
} from '../controllers/admin/studentAdmin.controller';
import {
  getAdminTestsHandler,
  getAdminTestByIdHandler,
  createTestAdminHandler,
  updateTestAdminHandler,
  deleteTestAdminHandler,
  completeTestAdminHandler,
  publishResultsAdminHandler,
  unpublishResultsAdminHandler
} from '../controllers/admin/testAdmin.controller';
import {
  getAdminQuestionsHandler,
  getQuestionByIdAdminHandler,
  createQuestionAdminHandler,
  updateQuestionAdminHandler,
  deleteQuestionAdminHandler,
  importQuestionsExcelHandler
} from '../controllers/admin/questionAdmin.controller';
import {
  uploadQuestionPaperHandler,
  uploadAnswerKeyHandler
} from '../controllers/admin/fileStorageAdmin.controller';
import {
  getTestAttendanceAdminHandler,
  updateStudentAttendanceAdminHandler
} from '../controllers/admin/attendanceAdmin.controller';
import {
  getTestAttemptsAdminHandler,
  getAttemptByIdAdminHandler,
  getTestResultsAdminHandler,
  getResultByIdAdminHandler,
  overrideStudentScoreAdminHandler
} from '../controllers/admin/attemptAndResultAdmin.controller';
import { getAdminDashboardHandler } from '../controllers/admin/dashboardAdmin.controller';

const router = Router();

// PUBLIC ADMIN AUTH
router.post('/auth/login', loginAdminHandler);

// PROTECTED ADMIN ROUTES
router.use(requireAdminAuth);

// AUTH STATE & DASHBOARD
router.post('/auth/logout', logoutAdminHandler);
router.get('/auth/me', getAdminMeHandler);
router.get('/dashboard', getAdminDashboardHandler);

// STUDENT MANAGEMENT
router.get('/students', getStudentsAdminHandler);
router.get('/students/:id', getStudentByIdAdminHandler);
router.post('/students', createStudentAdminHandler);
router.put('/students/:id', updateStudentAdminHandler);
router.delete('/students/:id', deleteStudentAdminHandler);
router.post('/students/import', uploadSingleFile, importStudentsExcelHandler);

// TEST MANAGEMENT
router.get('/tests', getAdminTestsHandler);
router.get('/tests/:id', getAdminTestByIdHandler);
router.post('/tests', createTestAdminHandler);
router.put('/tests/:id', updateTestAdminHandler);
router.delete('/tests/:id', deleteTestAdminHandler);
router.post('/tests/:testId/complete', completeTestAdminHandler);
router.post('/tests/:testId/publish', publishResultsAdminHandler);
router.post('/tests/:testId/unpublish', unpublishResultsAdminHandler);

// QUESTION MANAGEMENT
router.get('/tests/:testId/questions', getAdminQuestionsHandler);
router.get('/questions/:id', getQuestionByIdAdminHandler);
router.post('/tests/:testId/questions', createQuestionAdminHandler);
router.put('/questions/:id', updateQuestionAdminHandler);
router.delete('/questions/:id', deleteQuestionAdminHandler);
router.post('/tests/:testId/questions/import', uploadSingleFile, importQuestionsExcelHandler);

// QUESTION PAPERS & ANSWER KEYS
router.post('/tests/:testId/question-paper', uploadSingleFile, uploadQuestionPaperHandler);
router.post('/tests/:testId/answer-key', uploadSingleFile, uploadAnswerKeyHandler);

// ATTENDANCE MANAGEMENT
router.get('/tests/:testId/attendance', getTestAttendanceAdminHandler);
router.put('/tests/:testId/attendance/:studentId', updateStudentAttendanceAdminHandler);

// ATTEMPTS INSPECTION
router.get('/tests/:testId/attempts', getTestAttemptsAdminHandler);
router.get('/attempts/:attemptId', getAttemptByIdAdminHandler);

// RESULT MANAGEMENT & OVERRIDES
router.get('/tests/:testId/results', getTestResultsAdminHandler);
router.get('/results/:id', getResultByIdAdminHandler);
router.put('/results/:id', overrideStudentScoreAdminHandler);

export default router;
