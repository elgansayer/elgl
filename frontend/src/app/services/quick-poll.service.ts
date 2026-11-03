import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface PollResult {
  poll_id: string;
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
  is_active: boolean;
  userVote: number | null;
}

export type QuickPollRealtimeEvent =
  { type: 'poll_opened'; poll: PollResult } | { type: 'poll_updated'; poll: PollResult };

const MAX_POLL_OPTIONS = 6;
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 100;
const SAFE_API_MESSAGES = new Set([
  'You have already voted on this poll',
  'Poll is no longer active',
  'Poll not found',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isVoteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0)
  );
}

export function parsePollResult(value: unknown, fallbackPollId?: string): PollResult | null {
  if (!isRecord(value)) return null;
  const pollId = typeof value['poll_id'] === 'string' ? value['poll_id'] : fallbackPollId;
  if (
    !pollId ||
    typeof value['question'] !== 'string' ||
    !isStringArray(value['options']) ||
    !isVoteArray(value['votes']) ||
    value['options'].length !== value['votes'].length ||
    typeof value['totalVotes'] !== 'number' ||
    !Number.isInteger(value['totalVotes']) ||
    value['totalVotes'] < 0 ||
    value['votes'].reduce((total, count) => total + count, 0) !== value['totalVotes']
  ) {
    return null;
  }

  const userVote = value['userVote'];
  if (
    userVote !== undefined &&
    userVote !== null &&
    (typeof userVote !== 'number' ||
      !Number.isInteger(userVote) ||
      userVote < 0 ||
      userVote >= value['options'].length)
  ) {
    return null;
  }

  return {
    poll_id: pollId,
    question: value['question'],
    options: value['options'],
    votes: value['votes'],
    totalVotes: value['totalVotes'],
    is_active: typeof value['is_active'] === 'boolean' ? value['is_active'] : true,
    userVote: typeof userVote === 'number' ? userVote : null,
  };
}

export function parseQuickPollRealtimeEvent(value: unknown): QuickPollRealtimeEvent | null {
  if (!isRecord(value) || typeof value['type'] !== 'string') return null;

  if (value['type'] === 'poll_opened') {
    if (
      typeof value['poll_id'] !== 'string' ||
      typeof value['question'] !== 'string' ||
      !isStringArray(value['options'])
    ) {
      return null;
    }
    return {
      type: 'poll_opened',
      poll: {
        poll_id: value['poll_id'],
        question: value['question'],
        options: value['options'],
        votes: value['options'].map(() => 0),
        totalVotes: 0,
        is_active: true,
        userVote: null,
      },
    };
  }

  if (value['type'] === 'poll_updated') {
    const poll = parsePollResult(value);
    return poll ? { type: 'poll_updated', poll } : null;
  }

  return null;
}

@Injectable({ providedIn: 'root' })
export class QuickPollService {
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/audio-rooms`;

  private async apiFetch(path: string, options?: RequestInit): Promise<unknown> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    const responseText = await response.text();

    if (!response.ok) {
      let safeMessage = 'Quick poll request failed';
      if (responseText) {
        try {
          const payload: unknown = JSON.parse(responseText);
          if (
            isRecord(payload) &&
            typeof payload['message'] === 'string' &&
            SAFE_API_MESSAGES.has(payload['message'])
          ) {
            safeMessage = payload['message'];
          }
        } catch {
          // Do not expose arbitrary upstream response bodies to the UI.
        }
      }
      throw new Error(safeMessage);
    }

    if (!responseText) return undefined;

    const payload: unknown = JSON.parse(responseText);
    return payload;
  }

  async createPoll(
    roomId: string,
    question: string,
    options: string[],
  ): Promise<{ poll_id: string }> {
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

    const payload = await this.apiFetch(`/${encodeURIComponent(roomId)}/polls`, {
      method: 'POST',
      body: JSON.stringify({ question: normalisedQuestion, options: normalisedOptions }),
    });
    if (!isRecord(payload) || typeof payload['poll_id'] !== 'string') {
      throw new Error('Invalid quick poll response');
    }
    return { poll_id: payload['poll_id'] };
  }

  async submitVote(pollId: string, optionIndex: number): Promise<void> {
    if (!pollId || !Number.isInteger(optionIndex) || optionIndex < 0) {
      throw new Error('Invalid quick poll vote');
    }

    await this.apiFetch('/polls/vote', {
      method: 'POST',
      body: JSON.stringify({ pollId, optionIndex }),
    });
  }

  async getActivePoll(roomId: string): Promise<PollResult | null> {
    if (!roomId) throw new Error('Invalid quick poll');
    const payload = await this.apiFetch(`/${encodeURIComponent(roomId)}/polls/active`);
    if (payload === null) return null;
    const poll = parsePollResult(payload);
    if (!poll) throw new Error('Invalid quick poll response');
    return poll;
  }

  async getPollResults(roomId: string, pollId: string): Promise<PollResult> {
    if (!roomId || !pollId) {
      throw new Error('Invalid quick poll');
    }

    const payload = await this.apiFetch(
      `/${encodeURIComponent(roomId)}/polls/${encodeURIComponent(pollId)}`,
    );
    const poll = parsePollResult(payload, pollId);
    if (!poll) throw new Error('Invalid quick poll response');
    return poll;
  }
}
