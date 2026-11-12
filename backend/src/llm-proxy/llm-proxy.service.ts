import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderPromptGate } from '../llm-guard/provider-prompt-gate';
import { MetricsService } from '../metrics/metrics.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class LlmProxyService {
  private readonly promptGate: ProviderPromptGate;

  constructor(
    private readonly configService: ConfigService,
    @Optional() metricsService?: MetricsService,
  ) {
    this.promptGate = new ProviderPromptGate(
      'llm_proxy',
      new Logger(LlmProxyService.name),
      metricsService,
    );
  }

  /**
   * Sends messages to the configured provider. Build them with
   * buildDataPrompt or buildConversationPrompt from llm-guard: the messages
   * are validated and cleaned here whatever the caller did, and a prompt that
   * did not come from a builder is reported as `unguarded`. Throws
   * PromptGuardError before any request is made when the messages are
   * malformed or too large.
   */
  async chatCompletion(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<string> {
    const hardened = this.promptGate.harden(messages);

    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const apiUrl = this.configService.get<string>(
      'LLM_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    const model = this.configService.get<string>('LLM_MODEL', 'gpt-4');

    const payload = {
      model,
      messages: hardened.messages,
      max_tokens: 500,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) {
      throw new Error(`LLM provider returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.choices)) return '';
    const choices = data.choices as unknown[];
    const firstChoice = choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return '';
    return typeof firstChoice.message.content === 'string'
      ? firstChoice.message.content
      : '';
  }
}
