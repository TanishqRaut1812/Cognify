import { Request, Response, NextFunction } from 'express';
import {
  getStudentsAdmin,
  getStudentByIdAdmin,
  createStudentAdmin,
  updateStudentAdmin,
  deleteStudentAdmin,
  importStudentsFromExcel
} from '../../services/studentAdmin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { ValidationError } from '../../types/api.types';

export async function getStudentsAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classCode = req.query.class ? String(req.query.class) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const students = await getStudentsAdmin(classCode);
    sendSuccess(res, students);
  } catch (err) {
    next(err);
  }
}

export async function getStudentByIdAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid student ID');
    const student = await getStudentByIdAdmin(id);
    sendSuccess(res, student);
  } catch (err) {
    next(err);
  }
}

export async function createStudentAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const student = await createStudentAdmin(req.body);
    sendSuccess(res, student, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateStudentAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid student ID');
    const student = await updateStudentAdmin(id, req.body);
    sendSuccess(res, student);
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid student ID');
    await deleteStudentAdmin(id);
    sendSuccess(res, { message: 'Student deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function importStudentsExcelHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new ValidationError('No Excel file uploaded');
    const summary = await importStudentsFromExcel(req.file.buffer, req.file.originalname);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}
