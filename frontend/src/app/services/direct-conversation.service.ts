import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DirectConversationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/direct-conversations`;

  async openOrCreate(targetUserId: string): Promise<string> {
    const token = this.authService.getAccessToken();
    const response = await firstValueFrom(
      this.http.post<{ roomId: string }>(
        this.baseUrl,
        { targetUserId },
        { headers: { Authorization: `Bearer ${token ?? ''}` } },
      ),
    );

    if (!response.roomId) {
      throw new Error('Direct conversation response did not include a room ID');
    }
    return response.roomId;
  }
}
