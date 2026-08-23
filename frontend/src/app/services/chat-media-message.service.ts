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
  private readonly endpoint = `${environment.apiUrl}/media/chat/send`;

  async send(roomId: string, media: UploadedChatMedia): Promise<void> {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error('Sign in before sending chat media');
    if (!roomId || !media.objectKey) throw new Error('Chat media message is incomplete');

    await firstValueFrom(
      this.http.post(
        this.endpoint,
        {
          roomId,
          mediaKind: media.kind,
          objectKey: media.objectKey,
        },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
      ),
    );
  }
}
