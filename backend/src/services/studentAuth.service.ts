import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { AppError } from '../types/api.types';

export interface StudentAttemptJwtPayload {
  role: 'student_attempt';
  attemptId: number;
  testId: number;
  registrationNo: string;
  iat?: number;
  exp?: number;
}

export interface StudentSessionJwtPayload {
  role: 'student';
  registrationNo: string;
  iat?: number;
  exp?: number;
}

export function generateAttemptToken(
  attemptId: number,
  testId: number,
  registrationNo: string,
  durationMinutes: number = 60
): string {
  const payload: StudentAttemptJwtPayload = {
    role: 'student_attempt',
    attemptId,
    testId,
    registrationNo
  };

  const expiresInSeconds = (durationMinutes + 60) * 60;

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiresInSeconds
  });
}

export function verifyAttemptToken(token: string): StudentAttemptJwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as StudentAttemptJwtPayload;
    if (decoded.role !== 'student_attempt' || !decoded.attemptId) {
      throw new AppError('Invalid attempt session token', 403, 'FORBIDDEN');
    }
    return decoded;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('Invalid or expired student attempt token', 401, 'UNAUTHORIZED');
  }
}

export function generateStudentSessionToken(registrationNo: string): string {
  const payload: StudentSessionJwtPayload = {
    role: 'student',
    registrationNo: registrationNo.trim().toUpperCase()
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '12h'
  });
}

export function verifyStudentSessionToken(token: string): StudentSessionJwtPayload | StudentAttemptJwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.role === 'student' && decoded.registrationNo) {
      return decoded as StudentSessionJwtPayload;
    }
    if (decoded.role === 'student_attempt' && decoded.registrationNo) {
      return decoded as StudentAttemptJwtPayload;
    }
    throw new AppError('Invalid student session token payload', 403, 'FORBIDDEN');
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('Invalid or expired student session token', 401, 'UNAUTHORIZED');
  }
}
