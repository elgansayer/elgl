import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { SafetyService } from '../services/safety.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly safetyService = inject(SafetyService);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Authenticate the user and immediately populate the blocked‑user cache
   * so that the UI (context menu, message filtering) reflects real data.
   */
  async signIn(email: string, password: string): Promise<any> {
    // --- Authentication call (e.g. Supabase) ---
    const response = await lastValueFrom(
      this.http.post<any>(`${this.apiUrl}/auth/login`, { email, password }),
    );
    // --- Load blocked user IDs after successful auth ---
    await this.safetyService.loadBlockedUsers();
    return response;
  }

  /**
   * Re‑establish a session (e.g. from persistent storage) and reload the
   * block list so the UI is immediately consistent.
   */
  async resumeSession(): Promise<void> {
    // --- Token recovery logic (omitted for brevity) ---
    // Assume the user is now authenticated.
    await this.safetyService.loadBlockedUsers();
  }
}
