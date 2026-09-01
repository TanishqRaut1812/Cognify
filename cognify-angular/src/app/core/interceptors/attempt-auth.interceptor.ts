import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AttemptSessionService } from '../services/attempt-session.service';

export const attemptAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const attemptSessionService = inject(AttemptSessionService);
  const attemptToken = attemptSessionService.getAttemptToken();
  const studentToken = attemptSessionService.getStudentToken();

  // 1. Attach attemptToken for student attempt endpoints (/api/student/attempts/)
  if (attemptToken && req.url.includes('/api/student/attempts/')) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${attemptToken}`)
    });
    return next(authReq);
  }

  // 2. Attach studentToken or attemptToken for student results endpoint (/api/student/results)
  if (req.url.includes('/api/student/results')) {
    const activeToken = studentToken || attemptToken;
    if (activeToken) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${activeToken}`)
      });
      return next(authReq);
    }
  }

  return next(req);
};
