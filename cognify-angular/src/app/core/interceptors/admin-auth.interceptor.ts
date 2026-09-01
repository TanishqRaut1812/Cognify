import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const adminToken = authService.getAdminToken();

  // Attach admin token only for admin endpoints (/api/admin/) except login
  if (req.url.includes('/api/admin/') && !req.url.includes('/api/admin/auth/login')) {
    let headers = req.headers;
    if (adminToken) {
      headers = headers.set('Authorization', `Bearer ${adminToken}`);
    }
    const authReq = req.clone({
      headers,
      withCredentials: true
    });
    return next(authReq);
  }

  return next(req);
};
