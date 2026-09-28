import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface PollResult {
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
}

const MAX_POLL_OPTIONS = 6;
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 100;
const SAFE_API_MESSAGES = new Set([
  'You have already voted on this poll',
  'Poll is no longer active',
  'Poll not found',
]);

@Injectable({ providedIn: 'root' })
export class QuickPollService {
  private readonly authService = inject(AuthService);

  private async apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const res = await fetch(`/api/audio-rooms${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    const responseText = await res.text();

    if (!res.ok) {
      let safeMessage = 'Quick poll request failed';
      if (responseText) {
        try {
          const payload = JSON.parse(responseText) as { message?: unknown };
          if (typeof payload.message === 'string' && SAFE_API_MESSAGES.has(payload.message)) {
            safeMessage = payload.message;
          }
        } catch {
          // Do not expose arbitrary upstream response bodies to the UI.
        }
      }
      throw new Error(safeMessage);
    }

    if (!responseText) {
      return undefined as T;
    }

    return JSON.parse(responseText) as T;
  }

  async createPoll(roomId: string, question: string, options: string[]): Promise<{ poll_id: string }> {
    const normalisedQuestion = question.trim();
    const normalisedOptions = options.map((option) => option.trim()).filter(Boolean);
    const uniqueOptions = new Set(normalisedOptions.map((option) => option.toLocaleLowerCase()));

    if (
      !roomId ||
      !normalisedQuestion ||
      normalisedQuestion.length > MAX_QUESTION_LENGTH ||
      normalisedOptions.length < 2 ||
      normalisedOptions.length > MAX_POLL_OPTIONS ||
      normalisedOptions.some((option) => option.length > MAX_OPTION_LENGTH) ||
      uniqueOptions.size !== normalisedOptions.length
    ) {
      throw new Error('Invalid quick poll');
    }

    return this.apiFetch<{ poll_id: string }>(`/${encodeURIComponent(roomId)}/polls`, {
      method: 'POST',
      body: JSON.stringify({ question: normalisedQuestion, options: normalisedOptions }),
    });
  }

  async submitVote(pollId: string, optionIndex: number): Promise<void> {
    if (!pollId || !Number.isInteger(optionIndex) || optionIndex < 0) {
      throw new Error('Invalid quick poll vote');
    }

    await this.apiFetch<void>('/polls/vote', {
      method: 'POST',
      body: JSON.stringify({ pollId, optionIndex }),
    });
  }

  async getPollResults(roomId: string, pollId: string): Promise<PollResult> {
    if (!roomId || !pollId) {
      throw new Error('Invalid quick poll');
    }

    return this.apiFetch<PollResult>(
      `/${encodeURIComponent(roomId)}/polls/${encodeURIComponent(pollId)}`,
    );
  }
}
