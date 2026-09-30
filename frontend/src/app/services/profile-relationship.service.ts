import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProfileRelationshipService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  async follow(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/${encodeURIComponent(userId)}/follow`,
        {},
        { headers: this.headers() },
      ),
    );
  }

  async unfollow(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(userId)}/follow`, {
        headers: this.headers(),
      }),
    );
  }

  private headers(): { Authorization: string } {
    return {
      Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}`,
    };
  }
}
