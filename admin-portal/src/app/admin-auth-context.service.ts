import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface AdminContext {
  user: { id: string; email: string | null };
  capabilities: string[];
  authorizationModel: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthContextService {
  private readonly http = inject(HttpClient);
  private readonly contextState = signal<AdminContext | null>(null);

  readonly context = this.contextState.asReadonly();

  load(): Observable<AdminContext> {
    return this.http
      .get<AdminContext>('/api/admin/v1/me', { withCredentials: true })
      .pipe(tap((context) => this.contextState.set(context)));
  }

  hasCapability(capability: string): boolean {
    return this.contextState()?.capabilities.includes(capability) ?? false;
  }
}
