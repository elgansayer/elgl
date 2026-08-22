import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

export interface MessagePrivacyFilters {
  enabled?: boolean;
  allowEveryone?: boolean;
  allowedGenders?: string[];
  sameNativeLanguage?: boolean;
  sameTargetLanguage?: boolean;
  sameGender?: boolean;
  sameAge?: boolean;
  ageMin?: number;
  ageMax?: number;
}

interface ChatSettingsResponse {
  messageFilters?: MessagePrivacyFilters;
}

@Injectable({ providedIn: 'root' })
export class MessageFilterSettingsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly settingsUrl = `${environment.apiUrl}/chat/settings`;

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}`,
    };
  }

  async getFilters(): Promise<MessagePrivacyFilters> {
    const response = await firstValueFrom(
      this.http.get<ChatSettingsResponse>(this.settingsUrl, {
        headers: this.headers(),
      }),
    );
    return response.messageFilters ?? { enabled: false, allowEveryone: true };
  }

  async saveFilters(filters: MessagePrivacyFilters): Promise<MessagePrivacyFilters> {
    const response = await firstValueFrom(
      this.http.put<ChatSettingsResponse>(
        this.settingsUrl,
        { messageFilters: filters },
        { headers: this.headers() },
      ),
    );
    return response.messageFilters ?? filters;
  }
}
