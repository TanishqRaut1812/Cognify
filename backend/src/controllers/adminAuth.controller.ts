import { Request, Response, NextFunction } from 'express';
import { loginAdmin } from '../services/adminAuth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/apiResponse';

export async function loginAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { password } = req.body;
    const { token, expiresIn } = await loginAdmin(password);

    // Set HttpOnly cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    sendSuccess(res, {
      token,
      expiresIn,
      role: 'admin',
      message: 'Admin login successful'
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutAdminHandler(req: Request, res: Response): Promise<void> {
  res.clearCookie('admin_token');
  sendSuccess(res, { message: 'Admin logout successful' });
}

export async function getAdminMeHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  sendSuccess(res, {
    authenticated: true,
    user: req.user
  });
}
