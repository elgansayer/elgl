import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiPartnerReply {
  response: string;
}

@Injectable({ providedIn: 'root' })
export class AiConversationService {
  private readonly http = inject(HttpClient);

  generateReply(text: string): Promise<string> {
    const url = `${environment.apiUrl}/chat/ai-partner`;
    return firstValueFrom(
      this.http.post<AiPartnerReply>(url, { text })
    ).then((res) => res.response);
  }
}
