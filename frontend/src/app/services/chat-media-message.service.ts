import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UploadedChatMedia } from './chat-media.service';

@Injectable({ providedIn: 'root' })
export class ChatMediaMessageService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly endpoint = `${environment.apiUrl}/chat/messages`;

  async send(roomId: string, media: UploadedChatMedia): Promise<void> {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error('Sign in before sending chat media');
    if (!roomId || !media.url) throw new Error('Chat media message is incomplete');

    await firstValueFrom(
      this.http.post(
        this.endpoint,
        {
          room_id: roomId,
          message_type: media.kind,
          media_url: media.url,
        },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
      ),
    );
  }
}
