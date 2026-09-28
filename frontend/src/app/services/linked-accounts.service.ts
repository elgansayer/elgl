import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface LinkedAccount {
  provider: string;
  name?: string;
  active: boolean;
  created_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LinkedAccountsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/users/me/linked-accounts`;

  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    const res = await lastValueFrom(
      this.http.get<LinkedAccount[]>(`${this.baseUrl}`, {
        headers: this.auth.getBearerHeaders(),
      }),
    );
    return res;
  }

  async linkAccount(provider: string, name?: string): Promise<void> {
    await lastValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/link`,
        { provider, name },
        { headers: this.auth.getBearerHeaders() },
      ),
    );
  }

  async unlinkAccount(provider: string): Promise<void> {
    await lastValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/unlink`,
        { provider },
        { headers: this.auth.getBearerHeaders() },
      ),
    );
  }
}
