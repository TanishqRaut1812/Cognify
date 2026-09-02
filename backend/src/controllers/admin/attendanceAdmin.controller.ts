import { Request, Response, NextFunction } from 'express';
import {
  getTestAttendanceAdmin,
  updateStudentAttendanceAdmin,
  bulkUpdateAttendanceAdmin
} from '../../services/attendanceAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function getTestAttendanceAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const attendance = await getTestAttendanceAdmin(testId);
    sendSuccess(res, attendance);
  } catch (err) {
    next(err);
  }
}

export async function updateStudentAttendanceAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    const studentId = req.params.studentId;
    if (isNaN(testId) || !studentId) throw new ValidationError('Invalid test ID or registration number');
    const { status } = req.body;
    if (!status || !['Present', 'Absent'].includes(status)) {
      throw new ValidationError('Status must be Present or Absent');
    }
    const result = await updateStudentAttendanceAdmin(testId, studentId, status);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function bulkUpdateAttendanceAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId, 10);
    if (isNaN(testId)) throw new ValidationError('Invalid test ID');
    const { status } = req.body;
    if (!status || !['Present', 'Absent'].includes(status)) {
      throw new ValidationError('Status must be Present or Absent');
    }
    const result = await bulkUpdateAttendanceAdmin(testId, status);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
