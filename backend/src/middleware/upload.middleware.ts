import multer from 'multer';
import { ValidationError } from '../types/api.types';

const storage = multer.memoryStorage();

export const uploadSingleFile = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow excel and pdf files
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'application/octet-stream'
    ];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Invalid file format. Upload .xlsx or .pdf files only.'));
    }
  }
}).single('file');
