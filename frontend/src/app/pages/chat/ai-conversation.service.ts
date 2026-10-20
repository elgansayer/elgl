import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Scenario {
  id: string;
  name: string;
  icon: string;
}

export interface AiMessageReply {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class AiConversationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-conversation`;

  getScenarios(): Promise<Scenario[]> {
    return firstValueFrom(
      this.http.get<Scenario[]>(`${this.baseUrl}/scenarios`),
    );
  }

  sendMessage(
    text: string,
    scenarioId?: string,
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    return firstValueFrom(
      this.http.post<AiMessageReply>(`${this.baseUrl}/message`, {
        message: text,
        scenarioId: scenarioId ?? null,
        conversationHistory: conversationHistory ?? [],
      }),
    ).then((res) => res.reply);
  }
}
