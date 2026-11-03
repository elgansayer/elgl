import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import type { ChatMessage } from './chat.service';
import { UploadedChatMedia } from './chat-media.service';

@Injectable({ providedIn: 'root' })
export class ChatMediaMessageService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly endpoint = `${environment.apiUrl}/media/chat/send`;

  /**
   * Sends an uploaded object as a chat message. The endpoint is idempotent per uploaded object, so
   * a retry after a lost response resolves to the message that was already persisted.
   */
  async send(roomId: string, media: UploadedChatMedia): Promise<ChatMessage> {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error('Sign in before sending chat media');
    if (!roomId || !media.objectKey) throw new Error('Chat media message is incomplete');
    if (media.presentation === 'instant_video' && media.kind !== 'video') {
      throw new Error('Instant video presentation requires a video upload');
    }

    return firstValueFrom(
      this.http.post<ChatMessage>(
        this.endpoint,
        {
          roomId,
          mediaKind: media.kind,
          objectKey: media.objectKey,
          ...(media.presentation ? { presentation: media.presentation } : {}),
        },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
      ),
    );
  }
}
