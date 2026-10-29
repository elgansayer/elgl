import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  maxTokens?: number;
  signal?: AbortSignal;
}

const DEFAULT_MAX_TOKENS = 500;

class LlmProviderHttpError extends Error {
  constructor(status: number) {
    super(`LLM provider returned HTTP ${status}`);
    this.name = 'LlmProviderHttpError';
  }
}

function isAbortSignal(
  value: ChatCompletionOptions | AbortSignal,
): value is AbortSignal {
  return 'aborted' in value && typeof value.addEventListener === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class LlmProxyService {
  constructor(private readonly configService: ConfigService) {}

  async proxyMessage(
    text: string,
    options: ChatCompletionOptions | AbortSignal = {},
  ): Promise<{ response: string }> {
    const response = await this.chatCompletion(
      [{ role: 'user', content: text }],
      options,
    );
    return { response };
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions | AbortSignal = {},
  ): Promise<string> {
    const completionOptions = isAbortSignal(options)
      ? { signal: options }
      : options;
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const apiUrl = this.configService.get<string>(
      'LLM_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    const model = this.configService.get<string>('LLM_MODEL', 'gpt-4');

    const payload = {
      model,
      messages,
      max_tokens: completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
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
      signal: completionOptions.signal,
    });
    if (!response.ok) {
      throw new LlmProviderHttpError(response.status);
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
