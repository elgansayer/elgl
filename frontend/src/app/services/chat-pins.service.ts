import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatPinState {
  room_id: string;
  is_pinned: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatPinsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat`;

  private headers(): { Authorization: string } {
    return { Authorization: `Bearer ${this.auth.getAccessToken() ?? ''}` };
  }

  async getPinnedRoomIds(): Promise<string[]> {
    if (!this.auth.getAccessToken()) return [];
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/pinned-rooms`, {
        headers: this.headers(),
      }),
    );
  }

  async setPinned(roomId: string, isPinned: boolean): Promise<ChatPinState> {
    return firstValueFrom(
      this.http.put<ChatPinState>(
        `${this.baseUrl}/rooms/${encodeURIComponent(roomId)}/pin`,
        { is_pinned: isPinned },
        { headers: this.headers() },
      ),
    );
  }
}
