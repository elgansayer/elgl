import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import {
  AGE_GATE_ERROR_CODES,
  AgeGateService,
  readApiErrorCode,
} from '../services/age-gate.service';

export const AGE_GATE_ROUTE = '/age-gate';

/**
 * The server is the authority: any request from an account that has not passed
 * the age gate is refused with 403 and a stable code. This sends the user to
 * the age-gate screen instead of leaving them with a broken page, and leaves
 * the original error to propagate so callers still stop.
 */
export const ageGateInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const ageGate = inject(AgeGateService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        const code = readApiErrorCode(error);
        if (code === AGE_GATE_ERROR_CODES.required || code === AGE_GATE_ERROR_CODES.blocked) {
          ageGate.recordRejection(code);
          if (!router.url.startsWith(AGE_GATE_ROUTE)) {
            void router.navigateByUrl(AGE_GATE_ROUTE);
          }
        }
      }
      return throwError(() => error);
    }),
  );
};
