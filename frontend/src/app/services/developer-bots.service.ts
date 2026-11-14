import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const CUSTOM_BOT_TONES = ['friendly', 'formal', 'playful', 'strict'] as const;

export type CustomBotTone = (typeof CUSTOM_BOT_TONES)[number];

export interface CustomEducationalBot {
  id: string;
  owner_id: string;
  display_name: string;
  persona: string;
  target_language: string;
  tone: CustomBotTone;
  greeting: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomEducationalBotInput {
  display_name: string;
  persona: string;
  target_language: string;
  tone: CustomBotTone;
  greeting?: string;
  is_enabled?: boolean;
}

/** Developer/Creator tier only; the API enforces VipGuard + RequireVip('developer'). */
@Injectable({ providedIn: 'root' })
export class DeveloperBotsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/developer-bots`;

  listBots(): Promise<CustomEducationalBot[]> {
    return firstValueFrom(
      this.http.get<CustomEducationalBot[]>(this.baseUrl, {
        headers: this.authHeaders(),
      }),
    );
  }

  createBot(input: CustomEducationalBotInput): Promise<CustomEducationalBot> {
    return firstValueFrom(
      this.http.post<CustomEducationalBot>(this.baseUrl, input, {
        headers: this.authHeaders(),
      }),
    );
  }

  updateBot(id: string, input: Partial<CustomEducationalBotInput>): Promise<CustomEducationalBot> {
    return firstValueFrom(
      this.http.patch<CustomEducationalBot>(`${this.baseUrl}/${encodeURIComponent(id)}`, input, {
        headers: this.authHeaders(),
      }),
    );
  }

  deleteBot(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`, {
        headers: this.authHeaders(),
      }),
    );
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.auth.getAccessToken() ?? ''}` };
  }
}
