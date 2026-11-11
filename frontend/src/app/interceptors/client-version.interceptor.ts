import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { VersionService } from '../services/version.service';
import { APP_VERSION } from '../version.constants';

/** Header the API reads to enforce the minimum supported client version. */
export const CLIENT_VERSION_HEADER = 'X-App-Version';

const UPGRADE_REQUIRED_STATUS = 426;

/** Matches only requests addressed to our own API, never third-party hosts. */
export function isFirstPartyApiRequest(url: string): boolean {
  return url === environment.apiUrl || url.startsWith(`${environment.apiUrl}/`);
}

/**
 * Declares the build version on every first-party API call and opens the
 * blocking update surface when the API answers HTTP 426. The error is always
 * rethrown so the calling feature still observes the failed request.
 */
export const clientVersionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isFirstPartyApiRequest(req.url)) return next(req);

  const versionService = inject(VersionService);
  const declared = req.clone({ setHeaders: { [CLIENT_VERSION_HEADER]: APP_VERSION } });

  return next(declared).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === UPGRADE_REQUIRED_STATUS) {
        versionService.applyUpgradeRequired(error.error);
      }
      return throwError(() => error);
    }),
  );
};
