import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';

interface ClientErrorPayload {
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private apiService = inject(ApiService);

  handleError(err: unknown): void {
    // Let Angular's default behaviour handle HttpErrorResponse
    if (err instanceof Error) {
      this.reportError(err);
    }

    // Rethrow HttpErrorResponse to preserve Angular's built-in behaviour
    if (err instanceof HttpErrorResponse) {
      throw err;
    }
  }

  private reportError(error: Error): void {
    const payload: ClientErrorPayload = {
      message: error.message ?? 'Unknown client error',
      name: error.name ?? 'Error',
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
    };

    // Fire-and-forget: do not block the error propagation
    this.apiService
      .post('/api/analytics/client-error', payload, { requireAuth: false })
      .catch(() => {
        // Silently ignore: we cannot log a logging failure
      });
  }
}