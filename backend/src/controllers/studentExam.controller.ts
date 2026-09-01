import { Request, Response, NextFunction } from 'express';
import {
  verifyStudent,
  getAvailableTestsForStudent,
  startTestAttempt,
  getAttemptDetailsAdminOrStudent,
  getExamQuestionsForStudent,
  saveStudentAnswer,
  getSavedAnswersForStudent,
  reportFullscreenViolation,
  submitTestAttempt,
  getStudentResultsService
} from '../services/studentExam.service';
import { sendSuccess } from '../utils/apiResponse';
import { ValidationError } from '../types/api.types';

import { generateStudentSessionToken } from '../services/studentAuth.service';

export async function verifyStudentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { registrationNumber } = req.body;
    const student = await verifyStudent(registrationNumber);
    const studentToken = generateStudentSessionToken(student.registrationNumber);
    sendSuccess(res, { student, studentToken });
  } catch (err) {
    next(err);
  }
}

export async function getAvailableTestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const regNo = req.query.registrationNumber ? String(req.query.registrationNumber) : undefined;
    if (!regNo) throw new ValidationError('registrationNumber query parameter is required');
    const tests = await getAvailableTestsForStudent(regNo);
    sendSuccess(res, tests);
  } catch (err) {
    next(err);
  }
}

export async function startTestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const { registrationNumber } = req.body;
    const result = await startTestAttempt(registrationNumber, testId);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function getAttemptDetailsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(attemptId)) throw new ValidationError('Invalid attempt ID');
    const details = await getAttemptDetailsAdminOrStudent(attemptId);
    sendSuccess(res, details);
  } catch (err) {
    next(err);
  }
}

export async function getExamQuestionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(attemptId)) throw new ValidationError('Invalid attempt ID');
    const questions = await getExamQuestionsForStudent(attemptId);
    sendSuccess(res, questions);
  } catch (err) {
    next(err);
  }
}

export async function saveStudentAnswerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const questionId = parseInt(req.params.questionId, 10);
    if (isNaN(attemptId) || isNaN(questionId)) throw new ValidationError('Invalid attempt ID or question ID');
    const { selectedOption } = req.body;
    const result = await saveStudentAnswer(attemptId, questionId, selectedOption);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getSavedAnswersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(attemptId)) throw new ValidationError('Invalid attempt ID');
    const answers = await getSavedAnswersForStudent(attemptId);
    sendSuccess(res, { answers });
  } catch (err) {
    next(err);
  }
}

export async function reportFullscreenViolationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(attemptId)) throw new ValidationError('Invalid attempt ID');
    const result = await reportFullscreenViolation(attemptId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function submitTestAttemptHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(attemptId)) throw new ValidationError('Invalid attempt ID');
    const result = await submitTestAttempt(attemptId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getStudentResultsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const regNo = req.query.registrationNumber ? String(req.query.registrationNumber) : undefined;
    if (!regNo) throw new ValidationError('registrationNumber query parameter is required');
    const results = await getStudentResultsService(regNo);
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
}
