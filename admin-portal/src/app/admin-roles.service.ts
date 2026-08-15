import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminRoleInventoryEntry {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  capabilities: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminRolesService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  list(): Observable<AdminRoleInventoryEntry[]> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminRoleInventoryEntry[]>(`${apiBaseUrl}/admin/v1/roles`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
        }),
      ),
    );
  }
}
