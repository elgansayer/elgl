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

export interface SimplifyTextRequest {
  text: string;
}

export interface SimplifyTextResult {
  original: string;
  simplified: string;
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

const MAX_SIMPLIFY_SOURCE_LENGTH = 4000;
const MAX_SIMPLIFY_RESULT_LENGTH = 8000;

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

    const token = this.requireAccessToken();
    const response = await fetch(`${environment.apiUrl}/nlp/explain-grammar`, {
      method: 'POST',
      headers: this.authenticatedHeaders(token),
      body: JSON.stringify({ original, corrected }),
      cache: 'no-store',
      signal,
    });

    this.assertSuccessfulResponse(response, 'Grammar explanation');

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

  async simplifyText(
    request: SimplifyTextRequest,
    signal?: AbortSignal,
  ): Promise<SimplifyTextResult> {
    const text = request.text.trim();
    if (!text) {
      throw new NlpRequestError('empty', 'Text to simplify is required.');
    }
    if (text.length > MAX_SIMPLIFY_SOURCE_LENGTH) {
      throw new NlpRequestError(
        'request',
        `Text to simplify must be ${MAX_SIMPLIFY_SOURCE_LENGTH} characters or fewer.`,
      );
    }

    const token = this.requireAccessToken();
    const response = await fetch(`${environment.apiUrl}/nlp/simplify`, {
      method: 'POST',
      headers: this.authenticatedHeaders(token),
      body: JSON.stringify({ text }),
      cache: 'no-store',
      signal,
    });

    this.assertSuccessfulResponse(response, 'Simplification');

    const payload: unknown = await response.json();
    if (!this.isSimplifyTextResult(payload) || !payload.simplified.trim()) {
      throw new NlpRequestError('empty', 'No simplified text was returned.');
    }

    const simplified = payload.simplified.trim();
    if (payload.original.trim() !== text || simplified.length > MAX_SIMPLIFY_RESULT_LENGTH) {
      throw new NlpRequestError('request', 'Invalid simplification response.');
    }

    return {
      original: payload.original.trim(),
      simplified,
    };
  }

  private requireAccessToken(): string {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new NlpRequestError('auth', 'Authentication is required.');
    }
    return token;
  }

  private authenticatedHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private assertSuccessfulResponse(response: Response, operation: string): void {
    if (response.ok) return;
    if (response.status === 429) {
      throw new NlpRequestError(
        'rate_limit',
        `${operation} rate limit exceeded.`,
        response.status,
        this.parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new NlpRequestError('auth', 'Authentication is required.', response.status);
    }
    throw new NlpRequestError('request', `${operation} request failed.`, response.status);
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

  private isSimplifyTextResult(value: unknown): value is SimplifyTextResult {
    if (!value || typeof value !== 'object') return false;
    return (
      'original' in value &&
      typeof value.original === 'string' &&
      'simplified' in value &&
      typeof value.simplified === 'string'
    );
  }

  private parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
  }
}
