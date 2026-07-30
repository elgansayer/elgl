import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AiConversationService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-conversation`;

  async sendMessage(text: string): Promise<{ reply: string }> {
    return firstValueFrom(
      this.http.post<{ reply: string }>(`${this.baseUrl}/message`, {
        message: text,
      }),
    );
  }
}
