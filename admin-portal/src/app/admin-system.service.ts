import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export type AdminHealthState = 'healthy' | 'degraded';

export interface AdminSystemHealthSnapshot {
  state: AdminHealthState;
  checkedAt: string;
  dependencies: {
    database: AdminHealthState;
    redis: AdminHealthState;
  };
  dependencyLatencyMs: {
    database: number;
    redis: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminSystemService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  getHealth(): Observable<AdminSystemHealthSnapshot> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminSystemHealthSnapshot>(
          `${apiBaseUrl}/admin/v1/system/health`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        ),
      ),
    );
  }
}
