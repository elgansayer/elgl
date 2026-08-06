import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Options for API requests.
 * @template TFallback The type of the fallback value to return if unauthenticated.
 */
export interface ApiOptions<TFallback = unknown> {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?:
    | HttpParams
    | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>;
  /**
   * Value to return immediately if the user is unauthenticated and requireAuth is true.
   */
  fallback?: TFallback;
  /**
   * If true (default), the request is aborted if no auth token is present.
   */
  requireAuth?: boolean;
}

/**
 * A centralized wrapper around Angular's HttpClient.
 * Automatically injects the Authorization header and aborts unauthenticated
 * requests to secure endpoints to prevent 401 Unauthorized noise in the console
 * and during SSR.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  /**
   * Builds headers with the Authorization token if available.
   */
  private getAuthHeaders(
    customHeaders?: HttpHeaders | Record<string, string | string[]>,
  ): HttpHeaders | Record<string, string | string[]> {
    const token = this.authService.getAccessToken();

    if (!token) {
      return customHeaders ?? {};
    }

    if (customHeaders instanceof HttpHeaders) {
      return customHeaders.set('Authorization', `Bearer ${token}`);
    }

    return { ...(customHeaders ?? {}), Authorization: `Bearer ${token}` };
  }

  private checkAuth<TFallback>(
    url: string,
    options: ApiOptions<TFallback>,
  ): { shouldAbort: true; fallback: TFallback } | { shouldAbort: false } {
    const requireAuth = options.requireAuth ?? true;
    if (requireAuth && !this.authService.getAccessToken()) {
      if ('fallback' in options) {
        // Since 'fallback' is in options, it exists, but TS treats it as TFallback | undefined
        // We can safely return it by using an explicit type annotation on a variable.
        const fallbackValue: TFallback = options.fallback!;
        return { shouldAbort: true, fallback: fallbackValue };
      }
      // If no fallback is provided, we throw an error to prevent the request.
      throw new Error(`[ApiService] Prevented unauthorized request to: ${url}`);
    }
    return { shouldAbort: false };
  }

  async get<T, F = T>(url: string, options: ApiOptions<F> = {}): Promise<T | F> {
    const authCheck = this.checkAuth(url, options);
    if (authCheck.shouldAbort) {
      return authCheck.fallback;
    }

    return firstValueFrom(
      this.http.get<T>(url, {
        headers: this.getAuthHeaders(options.headers),
        params: options.params,
      }),
    );
  }

  async post<T, F = T>(url: string, body: unknown, options: ApiOptions<F> = {}): Promise<T | F> {
    const authCheck = this.checkAuth(url, options);
    if (authCheck.shouldAbort) {
      return authCheck.fallback;
    }

    return firstValueFrom(
      this.http.post<T>(url, body, {
        headers: this.getAuthHeaders(options.headers),
        params: options.params,
      }),
    );
  }

  async put<T, F = T>(url: string, body: unknown, options: ApiOptions<F> = {}): Promise<T | F> {
    const authCheck = this.checkAuth(url, options);
    if (authCheck.shouldAbort) {
      return authCheck.fallback;
    }

    return firstValueFrom(
      this.http.put<T>(url, body, {
        headers: this.getAuthHeaders(options.headers),
        params: options.params,
      }),
    );
  }

  async patch<T, F = T>(url: string, body: unknown, options: ApiOptions<F> = {}): Promise<T | F> {
    const authCheck = this.checkAuth(url, options);
    if (authCheck.shouldAbort) {
      return authCheck.fallback;
    }

    return firstValueFrom(
      this.http.patch<T>(url, body, {
        headers: this.getAuthHeaders(options.headers),
        params: options.params,
      }),
    );
  }

  async delete<T, F = T>(url: string, options: ApiOptions<F> = {}): Promise<T | F> {
    const authCheck = this.checkAuth(url, options);
    if (authCheck.shouldAbort) {
      return authCheck.fallback;
    }

    return firstValueFrom(
      this.http.delete<T>(url, {
        headers: this.getAuthHeaders(options.headers),
        params: options.params,
      }),
    );
  }

  /**
   * Exposes raw Observables for edge cases where `firstValueFrom` is not desired.
   * Note: This does NOT currently automatically abort unauthenticated requests.
   */
  getObservable<T>(url: string, options: ApiOptions = {}): Observable<T> {
    return this.http.get<T>(url, {
      headers: this.getAuthHeaders(options.headers),
      params: options.params,
    });
  }
}
