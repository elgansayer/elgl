import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface MessageFilters {
  age_min?: number;
  age_max?: number;
  allowed_genders?: string[];
  allowed_native_languages?: string[];
}

@Injectable({ providedIn: 'root' })
export class MessageFilterService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly url = `${environment.apiUrl}/users/me/message-filters`;

  async load(): Promise<MessageFilters> {
    return firstValueFrom(
      this.http.get<MessageFilters>(this.url, {
        headers: this.getHeaders(),
      }),
    );
  }

  async save(filters: MessageFilters): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(this.url, filters, {
        headers: this.getHeaders(),
      }),
    );
  }

  private getHeaders(): { Authorization: string } {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    return { Authorization: `Bearer ${token}` };
  }
}
