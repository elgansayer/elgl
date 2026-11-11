import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AccountSuspensionNoticeService } from '../services/account-suspension-notice.service';
import { isFirstPartyApiRequest } from './client-version.interceptor';

const FORBIDDEN_STATUS = 403;

/**
 * Tells the member why every request is being refused when an operator has
 * suspended the account. The error is always rethrown so the calling feature
 * still observes the failed request.
 */
export const accountSuspensionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isFirstPartyApiRequest(req.url)) return next(req);

  const notice = inject(AccountSuspensionNoticeService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === FORBIDDEN_STATUS) {
        notice.handle(error.error);
      }
      return throwError(() => error);
    }),
  );
};
