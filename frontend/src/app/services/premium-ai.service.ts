import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type PremiumAiServiceKey = 'conversation_analysis_report';

export interface PremiumAiServiceCatalogItem {
  key: PremiumAiServiceKey;
  name: string;
  description: string;
  cost_coins: number;
}

export interface ConversationAnalysisResult {
  run_id: string;
  service_key: PremiumAiServiceKey;
  cost_coins: number;
  coins_remaining: number;
  status: 'completed';
  report: string;
  message_count: number;
  reused: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REPORT_CHARS = 8000;

function isCatalogItem(value: unknown): value is PremiumAiServiceCatalogItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    item['key'] === 'conversation_analysis_report' &&
    typeof item['name'] === 'string' &&
    item['name'].length > 0 &&
    item['name'].length <= 120 &&
    typeof item['description'] === 'string' &&
    item['description'].length > 0 &&
    item['description'].length <= 500 &&
    typeof item['cost_coins'] === 'number' &&
    Number.isSafeInteger(item['cost_coins']) &&
    item['cost_coins'] > 0
  );
}

function isConversationAnalysisResult(value: unknown): value is ConversationAnalysisResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result['run_id'] === 'string' &&
    UUID_PATTERN.test(result['run_id']) &&
    result['service_key'] === 'conversation_analysis_report' &&
    typeof result['cost_coins'] === 'number' &&
    Number.isSafeInteger(result['cost_coins']) &&
    result['cost_coins'] > 0 &&
    typeof result['coins_remaining'] === 'number' &&
    Number.isSafeInteger(result['coins_remaining']) &&
    result['coins_remaining'] >= 0 &&
    result['status'] === 'completed' &&
    typeof result['report'] === 'string' &&
    result['report'].trim().length > 0 &&
    result['report'].length <= MAX_REPORT_CHARS &&
    typeof result['message_count'] === 'number' &&
    Number.isSafeInteger(result['message_count']) &&
    result['message_count'] >= 2 &&
    typeof result['reused'] === 'boolean'
  );
}

@Injectable({ providedIn: 'root' })
export class PremiumAiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/economy/premium-ai`;

  async getServices(): Promise<PremiumAiServiceCatalogItem[]> {
    const value: unknown = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/services`, {
        headers: this.authHeaders(),
      }),
    );
    if (!Array.isArray(value) || !value.every(isCatalogItem)) {
      throw new Error('Invalid premium AI service catalog response.');
    }
    return value;
  }

  /**
   * The caller owns the idempotency key and must reuse it when the outcome of
   * an HTTP request is unknown (for example, a network disconnect). A known
   * server failure that confirms a refund may use a new key for the next try.
   */
  async runConversationAnalysis(
    roomId: string,
    idempotencyKey: string,
  ): Promise<ConversationAnalysisResult> {
    if (!UUID_PATTERN.test(roomId)) {
      throw new Error('Invalid conversation room id.');
    }
    if (!UUID_PATTERN.test(idempotencyKey)) {
      throw new Error('Invalid premium AI idempotency key.');
    }

    const value: unknown = await firstValueFrom(
      this.http.post<unknown>(
        `${this.baseUrl}/conversation-analysis`,
        { room_id: roomId, idempotency_key: idempotencyKey },
        { headers: this.authHeaders() },
      ),
    );
    if (!isConversationAnalysisResult(value)) {
      throw new Error('Invalid conversation analysis response.');
    }
    return value;
  }

  createIdempotencyKey(): string {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
    if (!cryptoApi?.getRandomValues) {
      throw new Error('Secure random identifiers are unavailable.');
    }

    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  }

  private authHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    if (!token) throw new Error('Authentication required.');
    return { Authorization: `Bearer ${token}` };
  }
}
