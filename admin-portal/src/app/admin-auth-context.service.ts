import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, switchMap, tap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminContext {
  user: { id: string; email: string | null };
  capabilities: string[];
  authorizationModel: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthContextService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);
  private readonly contextState = signal<AdminContext | null>(null);

  readonly context = this.contextState.asReadonly();

  load(): Observable<AdminContext> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminContext>(`${apiBaseUrl}/admin/v1/me`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
        }),
      ),
      tap((context) => this.contextState.set(context)),
    );
  }

  clear(): void {
    this.contextState.set(null);
  }

  hasCapability(capability: string): boolean {
    return this.contextState()?.capabilities.includes(capability) ?? false;
  }
}
