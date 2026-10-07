import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable({ providedIn: 'root' })
export class DirectConversationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/direct-conversations`;

  async openOrCreate(targetUserId: string): Promise<string> {
    if (!UUID_PATTERN.test(targetUserId)) {
      throw new Error('Direct conversation target user ID is invalid');
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Direct conversation requires an authenticated session');
    }

    const response = await firstValueFrom(
      this.http.post<unknown>(
        this.baseUrl,
        { targetUserId },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    const roomId = isRecord(response) ? response['roomId'] : undefined;
    if (typeof roomId !== 'string' || !UUID_PATTERN.test(roomId)) {
      throw new Error('Direct conversation response did not include a valid room ID');
    }
    return roomId;
  }
}
