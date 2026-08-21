import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface PollResult {
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
}

@Injectable({ providedIn: 'root' })
export class QuickPollService {
  private readonly authService = inject(AuthService);

  private async apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = this.authService.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`/api/audio-rooms${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || 'API request failed');
    }
    const data: T = await res.json();
    return data;
  }

  async createPoll(roomId: string, question: string, options: string[]): Promise<{ poll_id: string }> {
    return this.apiFetch<{ poll_id: string }>(`/${roomId}/polls`, {
      method: 'POST',
      body: JSON.stringify({ question, options }),
    });
  }

  async submitVote(pollId: string, optionIndex: number): Promise<void> {
    await this.apiFetch('/polls/vote', {
      method: 'POST',
      body: JSON.stringify({ pollId, optionIndex }),
    });
  }

  async getPollResults(roomId: string, pollId: string): Promise<PollResult> {
    return this.apiFetch<PollResult>(`/${roomId}/polls/${pollId}`);
  }
}
