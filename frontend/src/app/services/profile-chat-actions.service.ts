import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface DirectChatResult {
  room_id: string;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ROOM_ID = /^[A-Za-z0-9_-]{1,128}$/;

@Injectable({ providedIn: 'root' })
export class ProfileChatActionsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/direct-rooms`;

  async openDirectChat(partnerId: string): Promise<DirectChatResult> {
    if (!UUID_V4.test(partnerId)) throw new Error('Invalid chat partner');

    const token = this.authService.getAccessToken();
    if (!token) throw new Error('Authentication required');

    const result = await firstValueFrom(
      this.http.post<DirectChatResult>(
        this.baseUrl,
        { partnerId },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    const roomId = result?.room_id?.trim();
    if (!roomId || !SAFE_ROOM_ID.test(roomId)) {
      throw new Error('Invalid direct chat response');
    }

    return { room_id: roomId };
  }
}
