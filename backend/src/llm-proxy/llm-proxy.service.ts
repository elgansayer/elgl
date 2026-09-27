import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  /** Upper bound on generated tokens. Defaults to DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
  /** Cancels the upstream HTTP request when the caller stops waiting for it. */
  signal?: AbortSignal;
}

const DEFAULT_MAX_TOKENS = 500;

class LlmProviderHttpError extends Error {
  constructor(status: number) {
    super(`LLM provider returned HTTP ${status}`);
    this.name = 'LlmProviderHttpError';
  }
}

@Injectable()
export class LlmProxyService {
  constructor(private readonly configService: ConfigService) {}

  async proxyMessage(
    text: string,
    options?: ChatCompletionOptions,
  ): Promise<{ response: string }> {
    const response = await this.chatCompletion(
      [{ role: 'user', content: text }],
      options,
    );
    return { response };
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const apiUrl = this.configService.get<string>(
      'LLM_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    const model = this.configService.get<string>('LLM_MODEL', 'gpt-4');

    const payload = {
      model,
      messages,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
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
      signal: options.signal,
    });
    if (!response.ok) {
      throw new LlmProviderHttpError(response.status);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
}
