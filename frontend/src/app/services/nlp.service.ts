import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ExplainGrammarRequest {
  original: string;
  corrected: string;
}

export interface ExplainGrammarResult {
  original: string;
  corrected: string;
  explanation: string;
}

export type NlpRequestErrorKind = 'auth' | 'rate_limit' | 'empty' | 'request';

export class NlpRequestError extends Error {
  constructor(
    readonly kind: NlpRequestErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'NlpRequestError';
  }
}

@Injectable({ providedIn: 'root' })
export class NlpService {
  private readonly authService = inject(AuthService);

  async explainGrammar(
    request: ExplainGrammarRequest,
    signal?: AbortSignal,
  ): Promise<ExplainGrammarResult> {
    const original = request.original.trim();
    const corrected = request.corrected.trim();
    if (!original || !corrected) {
      throw new NlpRequestError('empty', 'Both original and corrected text are required.');
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      throw new NlpRequestError('auth', 'Authentication is required.');
    }

    const response = await fetch(`${environment.apiUrl}/nlp/explain-grammar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ original, corrected }),
      cache: 'no-store',
      signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new NlpRequestError(
          'rate_limit',
          'Grammar explanation rate limit exceeded.',
          response.status,
          this.parseRetryAfter(response.headers.get('Retry-After')),
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new NlpRequestError('auth', 'Authentication is required.', response.status);
      }
      throw new NlpRequestError('request', 'Grammar explanation request failed.', response.status);
    }

    const payload: unknown = await response.json();
    if (!this.isExplainGrammarResult(payload) || !payload.explanation.trim()) {
      throw new NlpRequestError('empty', 'No grammar explanation was returned.');
    }

    return {
      original: payload.original,
      corrected: payload.corrected,
      explanation: payload.explanation.trim(),
    };
  }

  private isExplainGrammarResult(value: unknown): value is ExplainGrammarResult {
    if (!value || typeof value !== 'object') return false;
    return (
      'original' in value &&
      typeof value.original === 'string' &&
      'corrected' in value &&
      typeof value.corrected === 'string' &&
      'explanation' in value &&
      typeof value.explanation === 'string'
    );
  }

  private parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
  }
}
