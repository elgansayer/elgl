import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Scenario {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiConversationService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-conversation`;

  async getScenarios(): Promise<Scenario[]> {
    return firstValueFrom(
      this.http.get<Scenario[]>(`${this.baseUrl}/scenarios`),
    );
  }

  async sendMessage(
    text: string,
    scenarioId?: string,
  ): Promise<{ reply: string; scenarioId?: string }> {
    return firstValueFrom(
      this.http.post<{ reply: string; scenarioId?: string }>(
        `${this.baseUrl}/message`,
        {
          message: text,
          scenarioId: scenarioId ?? null,
        },
      ),
    );
  }
}
