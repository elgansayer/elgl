import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DirectConversationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  async openOrCreate(targetUserId: string): Promise<string> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await firstValueFrom(
      this.http.post<{ room_id: string }>(
        `${environment.apiUrl}/chat/direct`,
        { target_user_id: targetUserId },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    if (!response.room_id) {
      throw new Error('Conversation unavailable');
    }

    return response.room_id;
  }
}
